import { BadGatewayException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import axios, { AxiosInstance, AxiosError } from 'axios'
import axiosRetry from 'axios-retry'
import {
  BinStock,
  ErpCompany,
  ErpItem,
  ErpItemGroup,
  ErpWarehouse,
  ErpSupplier,
  ErpItemSupplier,
  ErpItemDefault,
  ErpItemStatus,
  ErpPurchaseReceiptSummary,
  ErpPurchaseReceipt,
  ErpItemPrice,
  ErpPriceList,
  ErpStockEntrySummary,
  ErpStockEntryDetail,
  ErpMaterialRequest,
  ErpMaterialRequestSummary
} from './interfaces/erp.interfaces'
import { AppSettings } from '../database/entities/app-settings.entity'

@Injectable()
export class ErpService {
  private readonly client: AxiosInstance
  private readonly baseUrl: string

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(AppSettings)
    private readonly appSettingsRepo: Repository<AppSettings>
  ) {
    this.baseUrl = this.configService.get<string>('ERP_BASE_URL') || ''
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `token ${this.configService.get<string>(
          'ERP_API_KEY'
        )}:${this.configService.get<string>('ERP_API_SECRET')}`,
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 15000
    })

    axiosRetry(this.client, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) =>
        axiosRetry.isNetworkOrIdempotentRequestError(error)
    })
  }

  private async ensureBaseUrl() {
    const settings = await this.appSettingsRepo.findOne({ where: { id: 1 } })
    const desired = settings?.erp_base_url || this.baseUrl
    if (desired && this.client.defaults.baseURL !== desired) {
      this.client.defaults.baseURL = desired
    }
  }

  private throwErpError(error: unknown): never {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status
      const data = error.response?.data as
        | { message?: string; exception?: string; error?: string }
        | undefined
      const detail =
        data?.exception ||
        data?.message ||
        data?.error ||
        (error as AxiosError).message ||
        'Unknown ERP error'
      throw new BadGatewayException(
        `ERP request failed (${status ?? 'no status'}): ${detail}`
      )
    }
    throw error
  }

  private isFilterFieldError(error: unknown): boolean {
    if (!axios.isAxiosError(error)) {
      return false
    }
    const data = error.response?.data as
      | { message?: string; exception?: string; error?: string }
      | undefined
    const text = `${data?.exception ?? ''} ${data?.message ?? ''} ${data?.error ?? ''}`
    return (
      text.includes('Field not permitted in query') ||
      text.includes('Unknown column') ||
      text.includes('Invalid field')
    )
  }

  private isPermissionError(error: unknown): boolean {
    if (!axios.isAxiosError(error)) {
      return false
    }
    const status = error.response?.status
    const data = error.response?.data as
      | { message?: string; exception?: string; error?: string }
      | undefined
    const text = `${data?.exception ?? ''} ${data?.message ?? ''} ${data?.error ?? ''}`
    return status === 403 || text.includes('PermissionError')
  }

  private async mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    fn: (item: T) => Promise<R>
  ): Promise<R[]> {
    const results: R[] = []
    let index = 0
    const workers = Array.from({ length: Math.min(limit, items.length) }).map(
      async () => {
        while (index < items.length) {
          const current = items[index]
          index += 1
          results.push(await fn(current))
        }
      }
    )
    await Promise.all(workers)
    return results
  }

  async getCompanies(): Promise<ErpCompany[]> {
    await this.ensureBaseUrl()
    const fields = JSON.stringify(['name', 'company_name', 'country'])
    try {
      const pageSize = 50
      const all: ErpCompany[] = []
      let offset = 0
      while (true) {
        const response = await this.client.get(
          `/api/resource/Company?fields=${encodeURIComponent(fields)}&limit_page_length=${pageSize}&limit_start=${offset}`
        )
        const page = response.data.data as ErpCompany[]
        all.push(...page)
        if (page.length < pageSize) break
        offset += pageSize
      }
      return all
    } catch (error) {
      this.throwErpError(error)
    }
  }

  async getWarehouses(company?: string): Promise<ErpWarehouse[]> {
    await this.ensureBaseUrl()
    const fields = JSON.stringify([
      'name',
      'warehouse_name',
      'parent_warehouse',
      'is_group',
      'company',
      'disabled'
    ])
    const baseFilters = company
      ? [
          ['company', '=', company],
          ['is_group', '=', 0]
        ]
      : [['is_group', '=', 0]]
    try {
      const filters = JSON.stringify(baseFilters)
      const pageSize = 200
      const all: ErpWarehouse[] = []
      let offset = 0
      while (true) {
        const response = await this.client.get(
          `/api/resource/Warehouse?fields=${encodeURIComponent(fields)}&filters=${encodeURIComponent(filters)}&limit_page_length=${pageSize}&limit_start=${offset}`
        )
        const page = response.data.data as ErpWarehouse[]
        all.push(...page)
        if (page.length < pageSize) break
        offset += pageSize
      }
      return all.filter((row: any) => !row.disabled)
    } catch (error) {
      this.throwErpError(error)
    }
  }

  async getItemGroups(_company?: string): Promise<ErpItemGroup[]> {
    await this.ensureBaseUrl()
    const isTruthyFlag = (value: unknown) => {
      if (value === 1 || value === true) return true
      const normalized = String(value ?? '').trim().toLowerCase()
      return normalized === '1' || normalized === 'true' || normalized === 'yes'
    }

    const fetchGroups = async (includeDisabled: boolean) => {
      const fieldList = includeDisabled
        ? ['name', 'parent_item_group', 'is_group', 'disabled']
        : ['name', 'parent_item_group', 'is_group']
      const filters = includeDisabled
        ? [['is_group', '=', 0], ['disabled', '=', 0]]
        : [['is_group', '=', 0]]
      const pageSize = 200
      const all: ErpItemGroup[] = []
      let offset = 0
      while (true) {
        const response = await this.client.get(
          `/api/resource/Item Group?fields=${encodeURIComponent(
            JSON.stringify(fieldList)
          )}&filters=${encodeURIComponent(JSON.stringify(filters))}&limit_page_length=${pageSize}&limit_start=${offset}`
        )
        const page = response.data.data as ErpItemGroup[]
        all.push(...page)
        if (page.length < pageSize) break
        offset += pageSize
      }
      return all
    }

    try {
      let list: ErpItemGroup[]
      try {
        list = await fetchGroups(true)
      } catch (err) {
        if (this.isFilterFieldError(err)) {
          // 'disabled' field not permitted — fetch without it and filter by name heuristic
          list = await fetchGroups(false)
        } else {
          throw err
        }
      }

      const filtered = list.filter((group: any) => {
        if (isTruthyFlag(group.disabled)) return false
        if (isTruthyFlag(group.is_group)) return false
        const name = String(group.name || '').toLowerCase()
        return !name.includes('disable') && !name.includes('disabled')
      })

      // Only return groups that have at least one non-disabled item
      try {
        const itemFields = JSON.stringify(['item_group'])
        const itemFilters = JSON.stringify([['disabled', '=', 0]])
        const pageSize = 500
        const groupsWithItems = new Set<string>()
        let offset = 0
        while (true) {
          const itemResponse = await this.client.get(
            `/api/resource/Item?fields=${encodeURIComponent(itemFields)}&filters=${encodeURIComponent(itemFilters)}&limit_page_length=${pageSize}&limit_start=${offset}`
          )
          const page = itemResponse.data.data as { item_group: string }[]
          page.forEach((i) => groupsWithItems.add(i.item_group))
          if (page.length < pageSize) break
          offset += pageSize
        }
        return filtered.filter((g) => groupsWithItems.has(g.name))
      } catch {
        return filtered
      }
    } catch (error) {
      this.throwErpError(error)
    }
  }

  async getItemsByGroups(itemGroups: string[]): Promise<ErpItem[]> {
    await this.ensureBaseUrl()
    const fields = JSON.stringify([
      'name',
      'item_name',
      'item_group',
      'stock_uom',
      'disabled'
    ])

    try {
      const filters = JSON.stringify([['item_group', 'in', itemGroups]])
      const pageSize = 500
      const all: ErpItem[] = []
      let offset = 0
      while (true) {
        const response = await this.client.get(
          `/api/resource/Item?filters=${encodeURIComponent(
            filters
          )}&fields=${encodeURIComponent(fields)}&limit_page_length=${pageSize}&limit_start=${offset}`
        )
        const page = response.data.data as ErpItem[]
        all.push(...page)
        if (page.length < pageSize) break
        offset += pageSize
      }
      return all.filter((item: any) => !item.disabled)
    } catch (error) {
      this.throwErpError(error)
    }
  }

  async getItemsByCodes(itemCodes: string[]): Promise<ErpItem[]> {
    await this.ensureBaseUrl()
    if (itemCodes.length === 0) {
      return []
    }
    const fields = JSON.stringify([
      'name',
      'item_name',
      'item_group',
      'stock_uom',
      'disabled'
    ])
    // Batch item codes to avoid URL length limits (ERPNext returns 400 for long URLs)
    const BATCH_SIZE = 50
    const all: ErpItem[] = []
    try {
      for (let b = 0; b < itemCodes.length; b += BATCH_SIZE) {
        const batch = itemCodes.slice(b, b + BATCH_SIZE)
        const pageSize = 500
        let offset = 0
        while (true) {
          const filters = JSON.stringify([['name', 'in', batch]])
          const response = await this.client.get(
            `/api/resource/Item?filters=${encodeURIComponent(
              filters
            )}&fields=${encodeURIComponent(
              fields
            )}&limit_page_length=${pageSize}&limit_start=${offset}`
          )
          const page = response.data.data as ErpItem[]
          all.push(...page)
          if (page.length < pageSize) {
            break
          }
          offset += pageSize
        }
      }
      return all.filter((item: any) => !item.disabled)
    } catch (error) {
      this.throwErpError(error)
    }
  }

  async searchItems(search: string): Promise<ErpItem[]> {
    await this.ensureBaseUrl()
    const fields = JSON.stringify([
      'name',
      'item_name',
      'item_group',
      'stock_uom',
      'disabled'
    ])
    try {
      const pageSize = 50
      const all: ErpItem[] = []
      let offset = 0
      while (true) {
        const filters = JSON.stringify([
          ['disabled', '=', 0],
          ['item_name', 'like', `%${search}%`]
        ])
        const response = await this.client.get(
          `/api/resource/Item?filters=${encodeURIComponent(
            filters
          )}&fields=${encodeURIComponent(
            fields
          )}&limit_page_length=${pageSize}&limit_start=${offset}`
        )
        const page = response.data.data as ErpItem[]
        all.push(...page)
        if (page.length < pageSize) {
          break
        }
        offset += pageSize
      }
      return all.filter((item: any) => !item.disabled)
    } catch (error) {
      // Some ERPNext setups reject GET filters; fall back to get_list POST
      if (axios.isAxiosError(error)) {
        try {
          const pageSize = 50
          const all: ErpItem[] = []
          let offset = 0
          const filters = [
            ['item_name', 'like', `%${search}%`]
          ]
          while (true) {
            const response = await this.client.post(
              '/api/method/frappe.client.get_list',
              {
                doctype: 'Item',
                fields: ['name', 'item_name', 'item_group', 'stock_uom', 'disabled'],
                filters,
                limit_start: offset,
                limit_page_length: pageSize
              }
            )
            const page = (response.data.message || response.data.data) as ErpItem[]
            all.push(...page)
            if (page.length < pageSize) {
              break
            }
            offset += pageSize
          }
          return all.filter((item: any) => !item.disabled)
        } catch (postError) {
          if (this.isPermissionError(postError)) {
            return []
          }
          if (this.isFilterFieldError(postError)) {
            return []
          }
          this.throwErpError(postError)
        }
      }
      if (this.isPermissionError(error)) {
        return []
      }
      if (this.isFilterFieldError(error)) {
        const fallbackFields = JSON.stringify([
          'name',
          'item_name',
          'item_group',
          'stock_uom'
        ])
        const fallbackFilters = JSON.stringify([
          ['item_name', 'like', `%${search}%`]
        ])
          try {
            const pageSize = 50
            const all: ErpItem[] = []
            let offset = 0
            while (true) {
              const response = await this.client.get(
                `/api/resource/Item?filters=${encodeURIComponent(
                  fallbackFilters
                )}&fields=${encodeURIComponent(
                  fallbackFields
                )}&limit_page_length=${pageSize}&limit_start=${offset}`
              )
              const page = response.data.data as ErpItem[]
              all.push(...page)
              if (page.length < pageSize) {
                break
              }
              offset += pageSize
            }
            return all.filter((item: any) => !item.disabled)
          } catch (fallbackError) {
            this.throwErpError(fallbackError)
          }
        }
        this.throwErpError(error)
    }
  }

  async listSuppliers(): Promise<ErpSupplier[]> {
    await this.ensureBaseUrl()
    try {
      const fields = JSON.stringify([
        'name',
        'supplier_name',
        'mobile_no',
        'disabled'
      ])
      const pageSize = 200
      const all: ErpSupplier[] = []
      let offset = 0
      while (true) {
        const response = await this.client.get(
          `/api/resource/Supplier?fields=${encodeURIComponent(
            fields
          )}&limit_page_length=${pageSize}&limit_start=${offset}`
        )
        const page = response.data.data as ErpSupplier[]
        all.push(...page)
        if (page.length < pageSize) {
          break
        }
        offset += pageSize
      }
      return all.filter((row: any) => !row.disabled)
    } catch (error) {
      if (this.isPermissionError(error)) {
        return []
      }
      if (this.isFilterFieldError(error)) {
        const fallbackFields = JSON.stringify(['name', 'supplier_name'])
        try {
          const pageSize = 200
          const all: ErpSupplier[] = []
          let offset = 0
          while (true) {
            const response = await this.client.get(
              `/api/resource/Supplier?fields=${encodeURIComponent(
                fallbackFields
              )}&limit_page_length=${pageSize}&limit_start=${offset}`
            )
            const page = response.data.data as ErpSupplier[]
            all.push(...page)
            if (page.length < pageSize) {
              break
            }
            offset += pageSize
          }
          return all.filter((row: any) => !row.disabled)
        } catch (fallbackError) {
          this.throwErpError(fallbackError)
        }
      }
      this.throwErpError(error)
    }
  }

  async getItemSuppliers(itemCodes: string[]): Promise<ErpItemSupplier[]> {
    await this.ensureBaseUrl()
    if (itemCodes.length === 0) {
      return []
    }
    const fields = JSON.stringify(['parent', 'supplier', 'price_list_rate'])
    const filters = JSON.stringify([['parent', 'in', itemCodes]])
    try {
      const pageSize = 500
      const all: ErpItemSupplier[] = []
      let offset = 0
      while (true) {
        const response = await this.client.get(
          `/api/resource/Item%20Supplier?filters=${encodeURIComponent(filters)}&fields=${encodeURIComponent(fields)}&limit_page_length=${pageSize}&limit_start=${offset}`
        )
        const page = response.data.data as ErpItemSupplier[]
        all.push(...page)
        if (page.length < pageSize) break
        offset += pageSize
      }
      return all
    } catch (error) {
      if (this.isPermissionError(error)) {
        return []
      }
      if (this.isFilterFieldError(error)) {
        return []
      }
      this.throwErpError(error)
    }
  }

  async getItemDefaults(itemCodes: string[]): Promise<ErpItemDefault[]> {
    await this.ensureBaseUrl()
    if (itemCodes.length === 0) {
      return []
    }
    const fields = JSON.stringify([
      'parent',
      'default_supplier',
      'default_company',
      'default_warehouse'
    ])
    const filters = JSON.stringify([['parent', 'in', itemCodes]])
    try {
      const pageSize = 500
      const all: ErpItemDefault[] = []
      let offset = 0
      while (true) {
        const response = await this.client.get(
          `/api/resource/Item%20Default?filters=${encodeURIComponent(filters)}&fields=${encodeURIComponent(fields)}&limit_page_length=${pageSize}&limit_start=${offset}`
        )
        const page = response.data.data as ErpItemDefault[]
        all.push(...page)
        if (page.length < pageSize) break
        offset += pageSize
      }
      return all
    } catch (error) {
      if (this.isPermissionError(error)) {
        return []
      }
      if (this.isFilterFieldError(error)) {
        return []
      }
      this.throwErpError(error)
    }
  }

  async getItemStatusesByCodes(itemCodes: string[]): Promise<ErpItemStatus[]> {
    await this.ensureBaseUrl()
    if (itemCodes.length === 0) {
      return []
    }
    const fields = JSON.stringify(['name', 'disabled'])
    try {
      const pageSize = 500
      const all: ErpItemStatus[] = []
      let offset = 0
      while (true) {
        const filters = JSON.stringify([['name', 'in', itemCodes]])
        const response = await this.client.get(
          `/api/resource/Item?filters=${encodeURIComponent(
            filters
          )}&fields=${encodeURIComponent(
            fields
          )}&limit_page_length=${pageSize}&limit_start=${offset}`
        )
        const page = response.data.data as ErpItemStatus[]
        all.push(...page)
        if (page.length < pageSize) {
          break
        }
        offset += pageSize
      }
      return all
    } catch (error) {
      if (this.isPermissionError(error)) {
        return []
      }
      if (this.isFilterFieldError(error)) {
        return []
      }
      this.throwErpError(error)
    }
  }

  async listPurchaseReceipts(
    dateFrom: string,
    dateTo: string
  ): Promise<ErpPurchaseReceiptSummary[]> {
    await this.ensureBaseUrl()
    const fields = JSON.stringify(['name', 'supplier', 'posting_date'])
    const filters = JSON.stringify([
      ['posting_date', 'between', [dateFrom, dateTo]]
    ])
    try {
      const pageSize = 500
      const all: ErpPurchaseReceiptSummary[] = []
      let offset = 0
      while (true) {
        const response = await this.client.get(
          `/api/resource/Purchase Receipt?filters=${encodeURIComponent(
            filters
          )}&fields=${encodeURIComponent(
            fields
          )}&limit_page_length=${pageSize}&limit_start=${offset}`
        )
        const page = response.data.data as ErpPurchaseReceiptSummary[]
        all.push(...page)
        if (page.length < pageSize) {
          break
        }
        offset += pageSize
      }
      return all
    } catch (error) {
      if (this.isPermissionError(error)) {
        return []
      }
      this.throwErpError(error)
    }
  }

  async getPurchaseReceipt(name: string): Promise<ErpPurchaseReceipt | null> {
    await this.ensureBaseUrl()
    try {
      const response = await this.client.get(
        `/api/resource/Purchase Receipt/${encodeURIComponent(name)}`
      )
      return response.data.data as ErpPurchaseReceipt
    } catch (error) {
      if (this.isPermissionError(error)) {
        return null
      }
      this.throwErpError(error)
    }
  }

  async listPurchaseReceiptItemsByParents(
    parents: string[]
  ): Promise<Array<{ parent: string; item_code: string; rate: number }>> {
    await this.ensureBaseUrl()
    if (parents.length === 0) {
      return []
    }
    try {
      const filters = [
        ['parenttype', '=', 'Purchase Receipt'],
        ['parentfield', '=', 'items'],
        ['parent', 'in', parents]
      ]
      const pageSize = 500
      const all: Array<{ parent: string; item_code: string; rate: number }> = []
      let offset = 0
      while (true) {
        const response = await this.client.post(
          '/api/method/frappe.client.get_list',
          {
            doctype: 'Purchase Receipt Item',
            fields: ['parent', 'item_code', 'rate'],
            filters,
            limit_start: offset,
            limit_page_length: pageSize
          }
        )
        const page = (response.data.message || response.data.data) as Array<{
          parent: string
          item_code: string
          rate: number
        }>
        all.push(...page)
        if (page.length < pageSize) {
          break
        }
        offset += pageSize
      }
      return all
    } catch (error) {
      if (this.isPermissionError(error)) {
        return []
      }
      this.throwErpError(error)
    }
  }

  async getBinStock(warehouse: string): Promise<BinStock[]> {
    await this.ensureBaseUrl()
    const filters = JSON.stringify([['warehouse', '=', warehouse]])
    const fields = JSON.stringify([
      'item_code',
      'actual_qty',
      'stock_uom',
      'valuation_rate'
    ])
    try {
      const pageSize = 5000
      const all: BinStock[] = []
      let offset = 0
      while (true) {
        const response = await this.client.get(
          `/api/resource/Bin?filters=${encodeURIComponent(
            filters
          )}&fields=${encodeURIComponent(
            fields
          )}&limit_page_length=${pageSize}&limit_start=${offset}`
        )
        const page = response.data.data as BinStock[]
        all.push(...page)
        if (page.length < pageSize) {
          break
        }
        offset += pageSize
      }
      return all
    } catch (error) {
      if (this.isPermissionError(error)) {
        return []
      }
      this.throwErpError(error)
    }
  }

  async createStockEntryDraft(payload: Record<string, unknown>): Promise<string> {
    await this.ensureBaseUrl()
    try {
      const response = await this.client.post(
        '/api/resource/Stock Entry',
        payload
      )
      return response.data.data?.name as string
    } catch (error) {
      this.throwErpError(error)
    }
  }

  async updateStockEntryDraft(
    name: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    await this.ensureBaseUrl()
    try {
      await this.client.put(
        `/api/resource/Stock Entry/${encodeURIComponent(name)}`,
        payload
      )
    } catch (error) {
      this.throwErpError(error)
    }
  }

  async createStockReconciliationDraft(
    payload: Record<string, unknown>
  ): Promise<string> {
    await this.ensureBaseUrl()
    try {
      const response = await this.client.post(
        '/api/resource/Stock Reconciliation',
        payload
      )
      return response.data.data?.name as string
    } catch (error) {
      this.throwErpError(error)
    }
  }

  async submitStockEntry(name: string): Promise<void> {
    await this.ensureBaseUrl()
    try {
      await this.client.put(
        `/api/resource/Stock Entry/${encodeURIComponent(name)}`,
        { docstatus: 1 }
      )
    } catch (error) {
      this.throwErpError(error)
    }
  }

  async submitStockReconciliation(name: string): Promise<void> {
    await this.ensureBaseUrl()
    try {
      await this.client.put(
        `/api/resource/Stock Reconciliation/${encodeURIComponent(name)}`,
        { docstatus: 1 }
      )
    } catch (error) {
      this.throwErpError(error)
    }
  }

  async listDraftStockReconciliations() {
    await this.ensureBaseUrl()
    const filters = JSON.stringify([['docstatus', '=', 0]])
    const fields = JSON.stringify(['name', 'posting_date', 'purpose', 'company'])
    try {
      const pageSize = 500
      const all: Array<Record<string, unknown>> = []
      let offset = 0
      while (true) {
        const response = await this.client.get(
          `/api/resource/Stock Reconciliation?filters=${encodeURIComponent(filters)}&fields=${encodeURIComponent(fields)}&limit_page_length=${pageSize}&limit_start=${offset}`
        )
        const page = response.data.data as Array<Record<string, unknown>>
        all.push(...page)
        if (page.length < pageSize) break
        offset += pageSize
      }
      return all
    } catch (error) {
      this.throwErpError(error)
    }
  }

  async listDraftStockEntries() {
    await this.ensureBaseUrl()
    const filters = JSON.stringify([
      ['stock_entry_type', '=', 'Material Transfer'],
      ['docstatus', '=', 0]
    ])
    const fields = JSON.stringify([
      'name',
      'posting_date',
      'stock_entry_type',
      'remarks'
    ])
    try {
      const pageSize = 500
      const all: Array<Record<string, unknown>> = []
      let offset = 0
      while (true) {
        const response = await this.client.get(
          `/api/resource/Stock Entry?filters=${encodeURIComponent(filters)}&fields=${encodeURIComponent(fields)}&limit_page_length=${pageSize}&limit_start=${offset}`
        )
        const page = response.data.data as Array<Record<string, unknown>>
        all.push(...page)
        if (page.length < pageSize) break
        offset += pageSize
      }
      return all
    } catch (error) {
      this.throwErpError(error)
    }
  }

  async createPurchaseOrder(payload: Record<string, unknown>): Promise<string> {
    await this.ensureBaseUrl()
    try {
      const response = await this.client.post(
        '/api/resource/Purchase Order',
        payload
      )
      return response.data.data?.name as string
    } catch (error) {
      this.throwErpError(error)
    }
  }

  async submitPurchaseOrder(name: string): Promise<void> {
    await this.ensureBaseUrl()
    try {
      await this.client.put(
        `/api/resource/Purchase Order/${encodeURIComponent(name)}`,
        { docstatus: 1 }
      )
    } catch (error) {
      this.throwErpError(error)
    }
  }

  async listOpenPurchaseOrders(): Promise<Record<string, unknown>[]> {
    await this.ensureBaseUrl()
    const fields = JSON.stringify(['name', 'supplier', 'supplier_name', 'grand_total', 'status', 'transaction_date'])
    const filters = JSON.stringify([
      ['docstatus', '=', 1],
      ['status', 'not in', ['Completed', 'Cancelled', 'Closed']]
    ])
    const pageSize = 100
    const all: Record<string, unknown>[] = []
    let offset = 0
    try {
      while (true) {
        const response = await this.client.get(
          `/api/resource/Purchase Order?fields=${encodeURIComponent(fields)}&filters=${encodeURIComponent(filters)}&order_by=transaction_date desc&limit_page_length=${pageSize}&limit_start=${offset}`
        )
        const page = (response.data.data || []) as Record<string, unknown>[]
        all.push(...page)
        if (page.length < pageSize) break
        offset += pageSize
      }
      return all
    } catch (error) {
      this.throwErpError(error)
    }
  }

  async getPurchaseOrder(name: string): Promise<Record<string, unknown>> {
    await this.ensureBaseUrl()
    try {
      const response = await this.client.get(
        `/api/resource/Purchase Order/${encodeURIComponent(name)}`
      )
      return response.data.data as Record<string, unknown>
    } catch (error) {
      this.throwErpError(error)
    }
  }

  async createPurchaseReceipt(payload: Record<string, unknown>): Promise<string> {
    await this.ensureBaseUrl()
    try {
      const response = await this.client.post(
        '/api/resource/Purchase Receipt',
        payload
      )
      return response.data.data?.name as string
    } catch (error) {
      this.throwErpError(error)
    }
  }

  async submitPurchaseReceipt(name: string): Promise<void> {
    await this.ensureBaseUrl()
    try {
      await this.client.put(
        `/api/resource/Purchase Receipt/${encodeURIComponent(name)}`,
        { docstatus: 1 }
      )
    } catch (error) {
      this.throwErpError(error)
    }
  }

  async uploadFile(
    fileBuffer: Buffer,
    filename: string,
    doctype: string,
    docname: string
  ): Promise<{ file_url: string }> {
    await this.ensureBaseUrl()
    try {
      const FormData = (await import('form-data')).default
      const form = new FormData()
      form.append('file', fileBuffer, { filename, contentType: 'image/jpeg' })
      form.append('doctype', doctype)
      form.append('docname', docname)
      form.append('attached_to_doctype', doctype)
      form.append('attached_to_name', docname)
      form.append('is_private', '1')
      form.append('folder', 'Home/Attachments')

      const response = await this.client.post(
        '/api/method/upload_file',
        form,
        {
          headers: form.getHeaders(),
          timeout: 30000,
          maxContentLength: 10 * 1024 * 1024,
          maxBodyLength: 10 * 1024 * 1024
        }
      )
      return { file_url: response.data?.message?.file_url || '' }
    } catch (error) {
      this.throwErpError(error)
    }
  }

  async getPriceLists(): Promise<ErpPriceList[]> {
    await this.ensureBaseUrl()
    const fields = JSON.stringify(['name', 'enabled'])
    const filters = JSON.stringify([['enabled', '=', 1]])
    const pageSize = 100
    const fetchAll = async (url: string) => {
      const all: ErpPriceList[] = []
      let offset = 0
      while (true) {
        const response = await this.client.get(`${url}&limit_page_length=${pageSize}&limit_start=${offset}`)
        const page = response.data.data as ErpPriceList[]
        all.push(...page)
        if (page.length < pageSize) break
        offset += pageSize
      }
      return all
    }
    try {
      return await fetchAll(
        `/api/resource/Price List?fields=${encodeURIComponent(fields)}&filters=${encodeURIComponent(filters)}`
      )
    } catch (error) {
      if (this.isFilterFieldError(error)) {
        // ERP doesn't permit 'enabled' filter — fetch all and return as-is
        return await fetchAll(
          `/api/resource/Price List?fields=${encodeURIComponent(JSON.stringify(['name']))}`
        )
      }
      this.throwErpError(error)
    }
  }

  async getItemPrices(priceList: string): Promise<ErpItemPrice[]> {
    await this.ensureBaseUrl()
    const fields = JSON.stringify([
      'name', 'item_code', 'price_list', 'price_list_rate', 'uom', 'currency', 'valid_from'
    ])
    const filters = JSON.stringify([['price_list', '=', priceList], ['selling', '=', 0]])
    try {
      const pageSize = 500
      const all: ErpItemPrice[] = []
      let offset = 0
      while (true) {
        const response = await this.client.get(
          `/api/resource/Item Price?fields=${encodeURIComponent(fields)}&filters=${encodeURIComponent(filters)}&limit_page_length=${pageSize}&limit_start=${offset}`
        )
        const page = response.data.data as ErpItemPrice[]
        all.push(...page)
        if (page.length < pageSize) break
        offset += pageSize
      }
      return all
    } catch (error) {
      this.throwErpError(error)
    }
  }

  /**
   * Fetch detailed Purchase Receipt items for a batch of receipt names.
   * Returns item_code, item_name, qty, rate, uom per line.
   */
  async listPurchaseReceiptItemsDetailed(
    parents: string[]
  ): Promise<Array<{ parent: string; item_code: string; item_name: string; qty: number; rate: number; uom: string }>> {
    await this.ensureBaseUrl()
    if (parents.length === 0) return []
    try {
      const pageSize = 500
      const all: Array<{ parent: string; item_code: string; item_name: string; qty: number; rate: number; uom: string }> = []
      let offset = 0
      while (true) {
        const response = await this.client.post(
          '/api/method/frappe.client.get_list',
          {
            doctype: 'Purchase Receipt Item',
            fields: ['parent', 'item_code', 'item_name', 'qty', 'rate', 'uom'],
            filters: [
              ['parenttype', '=', 'Purchase Receipt'],
              ['parentfield', '=', 'items'],
              ['parent', 'in', parents]
            ],
            limit_start: offset,
            limit_page_length: pageSize
          }
        )
        const page = (response.data.message || response.data.data || []) as Array<{
          parent: string; item_code: string; item_name: string; qty: number; rate: number; uom: string
        }>
        all.push(...page)
        if (page.length < pageSize) break
        offset += pageSize
      }
      return all
    } catch (error) {
      if (this.isPermissionError(error)) return []
      if (this.isFilterFieldError(error)) return []
      this.throwErpError(error)
    }
  }

  /**
   * Fetch submitted Stock Entries (Material Transfer / Material Issue)
   * where items move OUT of `warehouse`, posted on or after `dateFrom`.
   */
  async listSubmittedStockEntriesByWarehouse(
    warehouse: string,
    dateFrom: string
  ): Promise<ErpStockEntrySummary[]> {
    await this.ensureBaseUrl()
    const filters = JSON.stringify([
      ['from_warehouse', '=', warehouse],
      ['docstatus', '=', 1],
      ['posting_date', '>=', dateFrom],
      ['stock_entry_type', 'in', ['Material Transfer', 'Material Issue']]
    ])
    const fields = JSON.stringify(['name', 'posting_date', 'from_warehouse', 'stock_entry_type'])
    try {
      const pageSize = 500
      const all: ErpStockEntrySummary[] = []
      let offset = 0
      while (true) {
        const response = await this.client.get(
          `/api/resource/Stock Entry?filters=${encodeURIComponent(filters)}&fields=${encodeURIComponent(fields)}&limit_page_length=${pageSize}&limit_start=${offset}`
        )
        const page = response.data.data as ErpStockEntrySummary[]
        all.push(...page)
        if (page.length < pageSize) break
        offset += pageSize
      }
      return all
    } catch (error) {
      if (this.isPermissionError(error)) return []
      this.throwErpError(error)
    }
  }

  /**
   * Fetch line items for a batch of Stock Entry names.
   */
  async getStockEntryDetails(entryNames: string[]): Promise<ErpStockEntryDetail[]> {
    await this.ensureBaseUrl()
    if (entryNames.length === 0) return []
    try {
      const pageSize = 500
      const all: ErpStockEntryDetail[] = []
      let offset = 0
      while (true) {
        const response = await this.client.post(
          '/api/method/frappe.client.get_list',
          {
            doctype: 'Stock Entry Detail',
            fields: ['parent', 'item_code', 'item_name', 'uom', 'qty', 's_warehouse'],
            filters: [['parent', 'in', entryNames]],
            limit_start: offset,
            limit_page_length: pageSize
          }
        )
        const page = (response.data.message || response.data.data || []) as ErpStockEntryDetail[]
        all.push(...page)
        if (page.length < pageSize) break
        offset += pageSize
      }
      return all
    } catch (error) {
      if (this.isPermissionError(error)) return []
      if (this.isFilterFieldError(error)) return []
      this.throwErpError(error)
    }
  }

  // ── Material Request ────────────────────────────────────────────────────────

  async findMaterialRequestByLocalId(
    localId: string
  ): Promise<ErpMaterialRequestSummary | null> {
    await this.ensureBaseUrl()
    const fields = JSON.stringify([
      'name',
      'material_request_type',
      'status',
      'docstatus',
      'company',
      'transaction_date',
      'schedule_date',
      'set_warehouse',
      'per_ordered',
      'custom_shift',
      'custom_local_id'
    ])
    const filters = JSON.stringify([
      ['material_request_type', '=', 'Material Transfer'],
      ['custom_local_id', '=', String(localId)]
    ])

    try {
      const response = await this.client.get(
        `/api/resource/Material Request?fields=${encodeURIComponent(fields)}&filters=${encodeURIComponent(filters)}&order_by=modified desc&limit_page_length=1`
      )
      const rows = response.data.data as ErpMaterialRequestSummary[]
      return rows[0] ?? null
    } catch (error) {
      if (this.isPermissionError(error) || this.isFilterFieldError(error)) {
        return null
      }
      this.throwErpError(error)
    }
  }

  async createMaterialRequestDraft(payload: Record<string, unknown>): Promise<string> {
    await this.ensureBaseUrl()
    try {
      const response = await this.client.post(
        '/api/resource/Material Request',
        {
          ...payload,
          docstatus: 0,
          material_request_type: payload.material_request_type || 'Material Transfer'
        }
      )
      return response.data.data?.name as string
    } catch (error) {
      this.throwErpError(error)
    }
  }

  async updateMaterialRequest(name: string, payload: Record<string, unknown>): Promise<void> {
    await this.ensureBaseUrl()
    try {
      await this.client.put(
        `/api/resource/Material Request/${encodeURIComponent(name)}`,
        payload
      )
    } catch (error) {
      this.throwErpError(error)
    }
  }

  async submitMaterialRequest(name: string): Promise<void> {
    await this.ensureBaseUrl()
    try {
      await this.client.put(
        `/api/resource/Material Request/${encodeURIComponent(name)}`,
        { docstatus: 1 }
      )
    } catch (error) {
      this.throwErpError(error)
    }
  }

  async cancelMaterialRequest(name: string): Promise<void> {
    await this.ensureBaseUrl()
    try {
      await this.client.put(
        `/api/resource/Material Request/${encodeURIComponent(name)}`,
        { docstatus: 2 }
      )
    } catch (error) {
      this.throwErpError(error)
    }
  }

  async getMaterialRequest(name: string): Promise<ErpMaterialRequest | null> {
    await this.ensureBaseUrl()
    try {
      const response = await this.client.get(
        `/api/resource/Material Request/${encodeURIComponent(name)}`
      )
      return response.data.data as ErpMaterialRequest
    } catch (error) {
      if (this.isPermissionError(error)) return null
      this.throwErpError(error)
    }
  }

  async listMaterialRequests(filters?: Record<string, unknown>): Promise<ErpMaterialRequestSummary[]> {
    await this.ensureBaseUrl()
    const fields = JSON.stringify([
      'name', 'material_request_type', 'status', 'docstatus',
      'company', 'transaction_date', 'schedule_date',
      'set_warehouse', 'per_ordered',
      'custom_shift', 'custom_local_id'
    ])
    const filterArr: unknown[][] = [
      ['material_request_type', '=', 'Material Transfer']
    ]
    if (filters?.warehouse) {
      filterArr.push(['set_warehouse', '=', filters.warehouse])
    }
    if (filters?.status) {
      filterArr.push(['status', '=', filters.status])
    }
    if (filters?.from_date) {
      filterArr.push(['transaction_date', '>=', filters.from_date])
    }
    try {
      const pageSize = 200
      const all: ErpMaterialRequestSummary[] = []
      let offset = 0
      while (true) {
        const response = await this.client.get(
          `/api/resource/Material Request?fields=${encodeURIComponent(fields)}&filters=${encodeURIComponent(JSON.stringify(filterArr))}&order_by=transaction_date desc&limit_page_length=${pageSize}&limit_start=${offset}`
        )
        const page = response.data.data as ErpMaterialRequestSummary[]
        all.push(...page)
        if (page.length < pageSize) break
        offset += pageSize
      }
      return all
    } catch (error) {
      if (this.isPermissionError(error)) return []
      // Custom fields may not exist yet — retry without them
      if (this.isFilterFieldError(error)) {
        const fallbackFields = JSON.stringify([
          'name', 'material_request_type', 'status', 'docstatus',
          'company', 'transaction_date', 'schedule_date',
          'set_warehouse', 'per_ordered'
        ])
        try {
          const pageSize = 200
          const all: ErpMaterialRequestSummary[] = []
          let offset = 0
          while (true) {
            const response = await this.client.get(
              `/api/resource/Material Request?fields=${encodeURIComponent(fallbackFields)}&filters=${encodeURIComponent(JSON.stringify(filterArr))}&order_by=transaction_date desc&limit_page_length=${pageSize}&limit_start=${offset}`
            )
            const page = response.data.data as ErpMaterialRequestSummary[]
            all.push(...page)
            if (page.length < pageSize) break
            offset += pageSize
          }
          return all
        } catch (fallbackError) {
          this.throwErpError(fallbackError)
        }
      }
      this.throwErpError(error)
    }
  }

  async upsertItemPrice(
    itemCode: string,
    priceList: string,
    rate: number,
    uom?: string
  ): Promise<void> {
    await this.ensureBaseUrl()
    // Find existing Item Price record for this item+price_list
    const filters = JSON.stringify([
      ['item_code', '=', itemCode],
      ['price_list', '=', priceList]
    ])
    try {
      const existing = await this.client.get(
        `/api/resource/Item Price?fields=${encodeURIComponent(JSON.stringify(['name']))}&filters=${encodeURIComponent(filters)}&limit_page_length=1`
      )
      const rows = existing.data.data as { name: string }[]
      if (rows.length > 0) {
        await this.client.put(
          `/api/resource/Item Price/${encodeURIComponent(rows[0].name)}`,
          { price_list_rate: rate }
        )
      } else {
        await this.client.post('/api/resource/Item Price', {
          item_code: itemCode,
          price_list: priceList,
          price_list_rate: rate,
          ...(uom ? { uom } : {})
        })
      }
    } catch (error) {
      this.throwErpError(error)
    }
  }
}
