'use client';

type ShareMessageOptions = {
  title?: string;
  text: string;
  phone?: string | null;
  preferNative?: boolean;
  copiedMessage?: string;
};

const MOBILE_BROWSER_PATTERN =
  /Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i;

function isProbablyMobileBrowser() {
  if (typeof navigator === 'undefined') {
    return false;
  }
  return MOBILE_BROWSER_PATTERN.test(navigator.userAgent || '');
}

function normalizePhone(phone?: string | null) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) {
    return '';
  }
  if (digits.length === 10) {
    return `91${digits}`;
  }
  if (digits.startsWith('00')) {
    return digits.slice(2);
  }
  return digits;
}

function buildWhatsAppUrl(text: string, phone?: string | null) {
  const normalizedPhone = normalizePhone(phone);
  const encodedText = encodeURIComponent(text);
  return normalizedPhone
    ? `https://api.whatsapp.com/send?phone=${normalizedPhone}&text=${encodedText}`
    : `https://api.whatsapp.com/send?text=${encodedText}`;
}

function openExternalUrl(url: string) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  // Mobile browsers are much more reliable with same-tab navigation than popup tabs.
  if (isProbablyMobileBrowser()) {
    window.location.assign(url);
    return;
  }

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

async function copyTextToClipboard(text: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  if (typeof document === 'undefined') {
    return false;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  return copied;
}

function isAbortError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: string }).name === 'AbortError'
  );
}

export async function shareMessage({
  title,
  text,
  phone,
  preferNative = true,
  copiedMessage = 'Message copied to clipboard'
}: ShareMessageOptions) {
  const textBody = text.trim();
  const payload = [title?.trim(), textBody].filter(Boolean).join('\n').trim();
  if (!textBody) {
    return 'empty';
  }

  if (
    preferNative &&
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function'
  ) {
    try {
      await navigator.share({ title, text: textBody });
      return 'native';
    } catch (error) {
      if (isAbortError(error)) {
        return 'cancelled';
      }
    }
  }

  try {
    openExternalUrl(buildWhatsAppUrl(payload, phone));
    return 'whatsapp';
  } catch {
    // Fall through to clipboard if navigation fails for any reason.
  }

  try {
    const copied = await copyTextToClipboard(payload);
    if (copied && copiedMessage && typeof window !== 'undefined') {
      window.alert(copiedMessage);
    }
    return copied ? 'clipboard' : 'failed';
  } catch {
    return 'failed';
  }
}
