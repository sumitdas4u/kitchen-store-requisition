import { MigrationInterface, QueryRunner } from 'typeorm'
import * as bcrypt from 'bcrypt'

const SOURCE_WAREHOUSE = 'Stores - FSRaC'
const ROLE = 'Kitchen User'
const DEFAULT_PASSWORD = 'Welcome@1234'

const USERS = [
  { username: 'anybelly', full_name: 'AnyBelly', warehouse: 'AnyBelly - FSRaC', email: 'anybelly@foodstudio.local' },
  { username: 'chinese-chinatown', full_name: 'Chinese - China Town', warehouse: 'Chinese - China Town - FSRaC', email: 'chinese-chinatown@foodstudio.local' },
  { username: 'chinese-kitchen', full_name: 'Chinese Kitchen', warehouse: 'Chinese Kitchen - FSRaC', email: 'chinese-kitchen@foodstudio.local' },
  { username: 'fb-raw-floor', full_name: 'F&B Raw Material - FLOOR', warehouse: 'F&B Raw Material - FLOOR - FSRaC', email: 'fb-raw-floor@foodstudio.local' },
  { username: 'foodstudio-midnapore', full_name: 'Food Studio Express Midnapore', warehouse: 'Food Studio Express Midnapore - FSRaC', email: 'foodstudio-midnapore@foodstudio.local' },
  { username: 'housekeeping', full_name: 'House Keeping', warehouse: 'House Keeping - FSRaC', email: 'housekeeping@foodstudio.local' },
  { username: 'indian-kitchen', full_name: 'Indian Kitchen', warehouse: 'Indian Kitchen - FSRaC', email: 'indian-kitchen@foodstudio.local' },
  { username: 'roll-chinatown', full_name: 'Roll - China Town', warehouse: 'Roll - China Town - FSRaC', email: 'roll-chinatown@foodstudio.local' },
  { username: 'staff-foods', full_name: 'Staff Foods', warehouse: 'Staff Foods - FSRaC', email: 'staff-foods@foodstudio.local' },
  { username: 'tandoor-kitchen', full_name: 'Tandoor Kitchen', warehouse: 'Tandoor Kitchen - FSRaC', email: 'tandoor-kitchen@foodstudio.local' },
]

// Items per warehouse (item_code only; name/group stored in ERPNext)
const WAREHOUSE_ITEMS: Record<string, string[]> = {
  'AnyBelly - FSRaC': [
    'FS/INV/00398', 'FS/INV/00611', 'SKILL/INV/00270', 'FS/INV/00573', 'FS/INV/00436',
    'FS/INV/00924', 'SKILL/INV/00284', 'SKILL/INV/00338', 'FS/INV/00568', 'FS/INV/00915',
    'FS/INV/00959', 'FS/INV/00960', 'SKILL/INV/00286', 'FS/INV/00896', 'SKILL/INV/00276',
    'FS/INV/01050', 'SKILL/INV/00321', 'SKILL/INV/00302', 'FS/INV/01066', 'FS/INV/00391',
    'FS/INV/01035', 'FS/INV/00734', 'FS/INV/00774', 'FS/INV/00741', 'FS/INV/00742',
    'FS/INV/00797', 'FS/INV/00884', 'SKILL/INV/00334', 'FS/INV/00788', 'FS/INV/00764',
    'FS/INV/01064', 'SKILL/INV/00280', 'SKILL/INV/00361', 'FS/INV/00632', 'FS/INV/00727',
    'FS/INV/00577', 'SKILL/INV/00294', 'FS/INV/00570', 'SKILL/INV/00072', 'SKILL/INV/00298',
    'FS/INV/00516', 'FS/INV/00473', 'FS/INV/00917', 'FS/INV/00833', 'FS/INV/00958',
    'FS/INV/01068', 'FS/INV/00920', 'FS/INV/01106', 'FS/INV/00912', 'FS/INV/00918',
    'FS/INV/00451', 'FS/INV/00415', 'FS/INV/00487', 'FS/INV/00631', 'FS/INV/00834',
    'FS/INV/00737', 'SKILL/INV/00268', 'FS/INV/00379', 'FS/INV/00916', 'FS/INV/00744',
    'FS/INV/00865', 'FS/INV/00438', 'SKILL/INV/00261', 'FS/INV/00592', 'SKILL/INV/00295',
    'SKILL/INV/00265', 'SKILL/INV/00262', 'SKILL/INV/00316', 'SKILL/INV/00329', 'FS/INV/01042',
    'FS/INV/00766', 'SKILL/INV/00264', 'SKILL/INV/00267', 'SKILL/INV/00283', 'SKILL/INV/00296',
    'SKILL/INV/00355', 'SKILL/INV/00356', 'SKILL/INV/00357', 'FS/INV/00512', 'FS/INV/01118',
    'FS/INV/01119', 'FS/INV/00772', 'FS/INV/00892', 'FS/INV/00998', 'FS/INV/00437',
    'FS/INV/01140', 'FS/INV/01141', 'FS/INV/01145', 'FS/INV/00851', 'FS/INV/01055',
    'SKILL/INV/00353', 'FS/INV/01067', 'FS/INV/00775', 'FS/INV/01051', 'FS/INV/00399',
    'FS/INV/00746', 'FS/INV/00598', 'FS/INV/00600', 'FS/INV/00897', 'FS/INV/00562',
    'FS/INV/01153', 'FS/INV/01152', 'FS/INV/01154', 'FS/INV/01155', 'FS/INV/01156',
    'FS/INV/01157', 'FS/INV/01158', 'FS/INV/01159', 'FS/INV/01160', 'SKILL/INV/00285',
    'FS/INV/00574', 'FS/INV/00467', 'FS/INV/00765', 'FS/INV/01162', 'FS/INV/01165',
    'FS/INV/01167', 'FS/INV/01164', 'FS/INV/00385', 'FS/INV/01172', 'SKILL/INV/00266',
    'FS/INV/00400', 'FS/INV/00599', 'FS/INV/00773', 'SKILL/INV/00272', 'FS/INV/00456',
    'FS/INV/01170', 'FS/INV/01168', 'FS/INV/00961', 'FS/INV/00923', 'FS/INV/01008',
    'FS/INV/00843', 'FS/INV/00591', 'FS/INV/01175', 'FS/INV/00419', 'SKILL/INV/00300',
    'FS/INV/01176', 'FS/INV/01178', 'FS/INV/01173', 'FS/INV/00890', 'FS/INV/01180',
    'FS/INV/01181', 'FS/INV/01182', 'FS/INV/01184', 'FS/INV/00626', 'FS/INV/00810',
    'FS/INV/00593', 'FS/INV/01088', 'FS/INV/01110', 'FS/INV/01185', 'SKILL/INV/00297',
    'SKILL/INV/00318', 'FS/INV/00786', 'FS/INV/01150', 'FS/INV/00894', 'FS/INV/00761',
    'FS/INV/00933', 'SKILL/INV/00336', 'FS/INV/01058', 'FS/INV/01086', 'SKILL/INV/00368',
    'SKILL/INV/00369', 'FS/INV/01089', 'FS/INV/01082', 'FS/INV/00745', 'FS/INV/01174',
    'FS/INV/00754', 'FS/INV/01112', 'SKILL/INV/00275', 'SKILL/INV/00317', 'FS/INV/00947',
    'FS/INV/00934', 'FS/INV/01151', 'FS/INV/00950', 'FS/INV/01065', 'FS/INV/01177',
    'SKILL/INV/00360', 'FS/INV/01046', 'FS/INV/00982', 'SKILL/INV/00390', 'FS/INV/00847',
    'FS/INV/00980', 'FS/INV/00979', 'SKILL/INV/00405', 'SKILL/INV/00410', 'SKILL/INV/00411',
    'SKILL/INV/00412', 'FS/INV/01186', 'SKILL/INV/00413', 'SKILL/INV/00414', 'SKILL/INV/00406',
    'FS/INV/00453', 'FS/INV/00416', 'FS/INV/00808', 'SKILL/INV/00299', 'SKILL/INV/00417',
    'SKILL/INV/00403', 'SKILL/INV/00391', 'FS/INV/00571', 'FS/INV/01179', 'FS/INV/00895',
    'FS/INV/00431', 'SKILL/INV/00456', 'FS/INV/01166', 'SKILL/INV/00440', 'FS/INV/00595',
    'FS/INV/00401', 'SKILL/INV/00428', 'FS/INV/00430', 'FS/INV/00578', 'SKILL/INV/00455',
    'SKILL/INV/00376', 'FS/INV/01149', 'FS/INV/00783', 'FS/INV/00423', 'SKILL/INV/00465',
    'FS/INV/00944', 'FS/INV/00893', 'FS/INV/00750', 'SKILL/INV/00463', 'FS/INV/01029',
    'FS/INV/00469', 'FS/INV/01062', 'FS/INV/01013', 'SKILL/INV/00475', 'SKILL/INV/00477',
    'SKILL/INV/00471', 'SKILL/INV/00491', 'SKILL/INV/00492', 'SKILL/INV/00493', 'SKILL/INV/00494',
    'SKILL/INV/00495', 'FS/INV/00929', 'FS/INV/01009', 'FS/INV/00800', 'FS/INV/00996',
    'FS/INV/00995', 'SKILL/INV/00377', 'SKILL/INV/00497', 'SKILL/INV/00499', 'SKILL/INV/00502',
    'SKILL/INV/00503', 'SKILL/INV/00468', 'SKILL/INV/00500', 'FS/INV/01040', 'SKILL/INV/00496',
    'SKILL/INV/00498', 'SKILL/INV/00472', 'FS/INV/01010', 'SKILL/INV/00279', 'SKILL/INV/00290',
    'SKILL/INV/00421', 'FS/INV/00994', 'SKILL/INV/00433', 'SKILL/INV/00277', 'SKILL/INV/00322',
    'FS/INV/00408', 'FS/INV/00501', 'SKILL/INV/00364', 'SKILL/INV/00512', 'SKILL/INV/00511',
    'FS/INV/01183', 'SKILL/INV/00519', 'SKILL/INV/00516', 'SKILL/INV/00515', 'FS/INV/00760',
    'FS/INV/00590', 'FS/INV/01005', 'SKILL/INV/00526', 'SKILL/INV/00525', 'SKILL/INV/00531',
    'SKILL/INV/00535', 'SKILL/INV/00532', 'SKILL/INV/00533', 'SKILL/INV/00436', 'SKILL/INV/00476',
    'SKILL/INV/00543', 'SKILL/INV/00546', 'SKILL/INV/00534', 'SKILL/INV/00545', 'SKILL/INV/00551',
    'SKILL/INV/00550', 'SKILL/INV/00281', 'SKILL/INV/00548', 'SKILL/INV/00490', 'FS/INV/00426',
    'FS/INV/00493', 'FS/INV/00442', 'SKILL/INV/00291', 'FS/INV/01004', 'SKILL/INV/00554',
    'FS/INV/00809', 'SKILL/INV/00555', 'SKILL/INV/00523', 'SKILL/INV/00553', 'SKILL/INV/00559',
    'SKILL/INV/00474', 'SKILL/INV/00571', 'SKILL/INV/00544', 'SKILL/INV/00425', 'SKILL/INV/00552',
    'FS/INV/00420', 'SKILL/INV/00539', 'FS/INV/00919', 'SKILL/INV/00504', 'SKILL/INV/00469',
    'SKILL/INV/00581', 'SKILL/INV/00572', 'SKILL/INV/00591', 'SKILL/INV/00459', 'SKILL/INV/00593',
    'SKILL/INV/00557', 'SKILL/INV/00450', 'SKILL/INV/00608', 'SKILL/INV/00607', 'SKILL/INV/00606',
    'SKILL/INV/00601', 'SKILL/INV/00569', 'FS/INV/00985', 'SKILL/INV/00610', 'FS/INV/00432',
    'SKILL/INV/00424', 'SKILL/INV/00625', 'SKILL/INV/00626', 'SKILL/INV/00449', 'FS/INV/00739',
    'SKILL/INV/00627', 'SKILL/INV/00642', 'FS/INV/01090', 'FS/INV/01091', 'SKILL/INV/00644',
    'SKILL/INV/00647', 'SKILL/INV/00629', 'SKILL/INV/00586', 'SKILL/INV/00654',
  ],

  'Chinese - China Town - FSRaC': [
    'SKILL/INV/00319', 'SKILL/INV/00272', 'SKILL/INV/00276', 'SKILL/INV/00289', 'SKILL/INV/00316',
    'SKILL/INV/00286', 'SKILL/INV/00307', 'SKILL/INV/00261', 'SKILL/INV/00264', 'SKILL/INV/00263',
    'SKILL/INV/00267', 'SKILL/INV/00339', 'FS/INV/00524', 'SKILL/INV/00274', 'SKILL/INV/00390',
    'SKILL/INV/00281', 'SKILL/INV/00335', 'SKILL/INV/00345', 'SKILL/INV/00268', 'SKILL/INV/00292',
    'FS/INV/00379', 'SKILL/INV/00295', 'FS/INV/01106', 'FS/INV/00578', 'FS/INV/00775',
    'SKILL/INV/00299', 'SKILL/INV/00571', 'SKILL/INV/00305', 'SKILL/INV/00277', 'FS/INV/00615',
    'SKILL/INV/00343', 'SKILL/INV/00346', 'SKILL/INV/00352', 'SKILL/INV/00308', 'FS/INV/00987',
    'SKILL/INV/00578', 'FS/INV/00999', 'FS/INV/00399', 'SKILL/INV/00265', 'FS/INV/01067',
    'SKILL/INV/00351', 'SKILL/INV/00273', 'SKILL/INV/00266', 'SKILL/INV/00317', 'FS/INV/00425',
    'FS/INV/00423', 'FS/INV/00626', 'SKILL/INV/00285', 'SKILL/INV/00336', 'FS/INV/00456',
    'FS/INV/01086', 'SKILL/INV/00278', 'FS/INV/00611', 'SKILL/INV/00269', 'SKILL/INV/00573',
    'FS/INV/00501', 'FS/INV/00959', 'FS/INV/01004', 'FS/INV/00742', 'SKILL/INV/00270',
    'FS/INV/00466', 'FS/INV/00496', 'FS/INV/01065', 'FS/INV/00502', 'FS/INV/00783',
    'FS/INV/00433', 'FS/INV/00787', 'FS/INV/00430', 'FS/INV/00797', 'FS/INV/00463',
    'SKILL/INV/00300', 'SKILL/INV/00350', 'SKILL/INV/00279', 'SKILL/INV/00283', 'FS/INV/01068',
    'FS/INV/00593', 'SKILL/INV/00370', 'SKILL/INV/00302', 'FS/INV/01033', 'FS/INV/01100',
    'SKILL/INV/00304', 'FS/INV/01105', 'FS/INV/00563', 'SKILL/INV/00537', 'FS/INV/00512',
    'SKILL/INV/00568', 'SKILL/INV/00363', 'SKILL/INV/00365', 'SKILL/INV/00581', 'FS/INV/00475',
    'SKILL/INV/00303', 'FS/INV/00778', 'FS/INV/01104', 'SKILL/INV/00364', 'SKILL/INV/00325',
    'SKILL/INV/00294', 'FS/INV/00469', 'FS/INV/00499', 'FS/INV/00590', 'FS/INV/01011',
    'FS/INV/00415', 'FS/INV/00514', 'SKILL/INV/00488', 'FS/INV/01058', 'FS/INV/00745',
    'FS/INV/00534', 'FS/INV/00431', 'FS/INV/00518', 'SKILL/INV/00518', 'SKILL/INV/00284',
    'SKILL/INV/00553', 'FS/INV/00766', 'FS/INV/01163', 'SKILL/INV/00508', 'FS/INV/00808',
    'FS/INV/00453', 'FS/INV/01094', 'FS/INV/00416', 'FS/INV/01039', 'FS/INV/00786',
    'FS/INV/00909', 'SKILL/INV/00298', 'FS/INV/01164', 'SKILL/INV/00376', 'FS/INV/01149',
    'FS/INV/00504', 'FS/INV/00412', 'FS/INV/00468', 'SKILL/INV/00282', 'SKILL/INV/00627',
    'SKILL/INV/00630', 'FS/INV/00886', 'SKILL/INV/00489', 'SKILL/INV/00556', 'SKILL/INV/00337',
    'SKILL/INV/00611',
  ],

  'Chinese Kitchen - FSRaC': [
    'SKILL/INV/00316', 'SKILL/INV/00277', 'SKILL/INV/00261', 'SKILL/INV/00299', 'SKILL/INV/00263',
    'SKILL/INV/00274', 'FS/INV/00626', 'SKILL/INV/00300', 'FS/INV/01011', 'FS/INV/00436',
    'SKILL/INV/00270', 'FS/INV/00433', 'FS/INV/00918', 'SKILL/INV/00272', 'SKILL/INV/00268',
    'FS/INV/00499', 'SKILL/INV/00271', 'SKILL/INV/00266', 'SKILL/INV/00319', 'FS/INV/00999',
    'FS/INV/00501', 'FS/INV/00502', 'SKILL/INV/00285', 'FS/INV/00424', 'SKILL/INV/00294',
    'SKILL/INV/00327', 'FS/INV/00783', 'FS/INV/00518', 'SKILL/INV/00295', 'SKILL/INV/00279',
    'SKILL/INV/00289', 'SKILL/INV/00292', 'FS/INV/00379', 'SKILL/INV/00262', 'SKILL/INV/00265',
    'SKILL/INV/00264', 'SKILL/INV/00308', 'SKILL/INV/00350', 'FS/INV/00534', 'SKILL/INV/00267',
    'SKILL/INV/00283', 'SKILL/INV/00281', 'SKILL/INV/00325', 'FS/INV/01058', 'SKILL/INV/00280',
    'FS/INV/00475', 'SKILL/INV/00317', 'FS/INV/00786', 'SKILL/INV/00286', 'SKILL/INV/00276',
    'SKILL/INV/00298', 'SKILL/INV/00351', 'SKILL/INV/00302', 'FS/INV/00611', 'SKILL/INV/00363',
    'SKILL/INV/00365', 'FS/INV/01060', 'FS/INV/00629', 'SKILL/INV/00275', 'SKILL/INV/00304',
    'FS/INV/01098', 'SKILL/INV/00336', 'SKILL/INV/00307', 'FS/INV/00425', 'FS/INV/00466',
    'FS/INV/00508', 'FS/INV/00759', 'FS/INV/00417', 'FS/INV/00458', 'SKILL/INV/00301',
    'FS/INV/00399', 'SKILL/INV/00273', 'FS/INV/01100', 'FS/INV/00775', 'FS/INV/00438',
    'FS/INV/01106', 'FS/INV/00505', 'FS/INV/00451', 'FS/INV/00431', 'SKILL/INV/00278',
    'FS/INV/00529', 'FS/INV/01030', 'FS/INV/01029', 'FS/INV/01105', 'FS/INV/00430',
    'FS/INV/01095', 'FS/INV/00739', 'FS/INV/00467', 'SKILL/INV/00337', 'FS/INV/01072',
    'FS/INV/00412', 'FS/INV/00778', 'SKILL/INV/00343', 'FS/INV/00985', 'FS/INV/01104',
    'FS/INV/00469', 'FS/INV/00493', 'FS/INV/00737', 'FS/INV/00437', 'FS/INV/00857',
    'FS/INV/00773', 'FS/INV/00745', 'FS/INV/00456', 'FS/INV/00497', 'FS/INV/00797',
    'FS/INV/00504', 'FS/INV/00528', 'FS/INV/00432', 'FS/INV/01163', 'FS/INV/00980',
    'FS/INV/00785', 'FS/INV/00922', 'FS/INV/00496', 'FS/INV/00463', 'FS/INV/01033',
    'FS/INV/01010', 'SKILL/INV/00367', 'SKILL/INV/00370', 'FS/INV/01164', 'SKILL/INV/00364',
    'SKILL/INV/00296', 'SKILL/INV/00360', 'FS/INV/00865', 'FS/INV/01174', 'FS/INV/00787',
    'FS/INV/01065', 'FS/INV/00909', 'FS/INV/00615', 'FS/INV/00512', 'SKILL/INV/00284',
    'SKILL/INV/00389', 'FS/INV/00465', 'FS/INV/00423', 'SKILL/INV/00303', 'FS/INV/00840',
    'SKILL/INV/00416', 'SKILL/INV/00420', 'SKILL/INV/00378', 'FS/INV/00916', 'SKILL/INV/00269',
    'FS/INV/00774', 'FS/INV/00459', 'SKILL/INV/00361', 'FS/INV/00920', 'SKILL/INV/00463',
    'FS/INV/00779', 'SKILL/INV/00357', 'FS/INV/00420', 'FS/INV/00415', 'SKILL/INV/00297',
    'FS/INV/00410', 'FS/INV/00408', 'SKILL/INV/00291', 'SKILL/INV/00313', 'SKILL/INV/00290',
    'FS/INV/00385', 'FS/INV/00924', 'FS/INV/01039', 'FS/INV/00462', 'FS/INV/00514',
    'SKILL/INV/00312', 'FS/INV/00796', 'FS/INV/01167', 'FS/INV/01108', 'SKILL/INV/00487',
    'SKILL/INV/00488', 'SKILL/INV/00489', 'FS/INV/01183', 'FS/INV/00982', 'FS/INV/01149',
    'FS/INV/01008', 'FS/INV/01152', 'FS/INV/00944', 'FS/INV/00808', 'FS/INV/00453',
    'FS/INV/00416', 'FS/INV/00578', 'SKILL/INV/00522', 'SKILL/INV/00481', 'FS/INV/00590',
    'FS/INV/00403', 'SKILL/INV/00527', 'SKILL/INV/00530', 'FS/INV/01040', 'SKILL/INV/00376',
    'SKILL/INV/00537', 'SKILL/INV/00536', 'FS/INV/00911', 'SKILL/INV/00518', 'SKILL/INV/00339',
    'FS/INV/00524', 'SKILL/INV/00567', 'SKILL/INV/00571', 'SKILL/INV/00575', 'FS/INV/00766',
    'SKILL/INV/00573', 'SKILL/INV/00508', 'FS/INV/00886', 'SKILL/INV/00599', 'SKILL/INV/00598',
    'SKILL/INV/00596', 'FS/INV/00912', 'SKILL/INV/00566', 'SKILL/INV/00617', 'SKILL/INV/00622',
    'SKILL/INV/00581', 'FS/INV/00979', 'SKILL/INV/00627', 'FS/INV/01094', 'FS/INV/01097',
    'SKILL/INV/00446', 'SKILL/INV/00523', 'FS/INV/01045', 'SKILL/INV/00321', 'FS/INV/00476',
    'SKILL/INV/00635', 'SKILL/INV/00655',
  ],

  // NOTE: This list is partial — the source data was truncated.
  // Add remaining items for this warehouse via the admin UI or a subsequent migration.
  'F&B Raw Material - FLOOR - FSRaC': [
    'SKILL/INV/00295', 'FS/INV/01094', 'FS/INV/01051', 'FS/INV/00575', 'FS/INV/00576',
    'FS/INV/00767', 'FS/INV/00810', 'FS/INV/00737', 'FS/INV/00433', 'FS/INV/00578',
    'FS/INV/01103', 'FS/INV/00775', 'SKILL/INV/00265', 'FS/INV/00459', 'FS/INV/00611',
    'SKILL/INV/00261', 'FS/INV/00984', 'FS/INV/00847', 'FS/INV/00765', 'SKILL/INV/00309',
    'SKILL/INV/00280', 'FS/INV/00400', 'FS/INV/00573', 'FS/INV/00879', 'FS/INV/00577',
    'FS/INV/00774', 'FS/INV/00579', 'FS/INV/00809', 'FS/INV/00745', 'FS/INV/00761',
    'FS/INV/01112', 'FS/INV/00583', 'FS/INV/00744', 'FS/INV/01138', 'FS/INV/01013',
    'FS/INV/00641', 'FS/INV/00640', 'FS/INV/00688', 'FS/INV/00880', 'FS/INV/00962',
    'FS/INV/00425', 'FS/INV/00574', 'SKILL/INV/00340', 'FS/INV/00399', 'FS/INV/00959',
    'FS/INV/00960', 'FS/INV/00746', 'SKILL/INV/00317', 'FS/INV/00791', 'FS/INV/01070',
    'SKILL/INV/00353', 'FS/INV/01001', 'FS/INV/01159', 'FS/INV/01032', 'SKILL/INV/00356',
    'SKILL/INV/00336', 'FS/INV/00980', 'FS/INV/01049', 'FS/INV/01031', 'FS/INV/01073',
    'FS/INV/01164', 'SKILL/INV/00264', 'FS/INV/00849', 'SKILL/INV/00299', 'FS/INV/00453',
    'FS/INV/00403', 'SKILL/INV/00270', 'SKILL/INV/00465', 'FS/INV/00456', 'SKILL/INV/00360',
    'SKILL/INV/00355', 'SKILL/INV/00520', 'SKILL/INV/00357', 'SKILL/INV/00481', 'SKILL/INV/00072',
    'FS/INV/00570', 'SKILL/INV/00542', 'FS/INV/01084', 'FS/INV/00843', 'FS/INV/00589',
    'SKILL/INV/00553', 'SKILL/INV/00474', 'SKILL/INV/00552', 'SKILL/INV/00597', 'SKILL/INV/00281',
    'FS/INV/00662', 'FS/INV/00876', 'FS/INV/00706', 'SKILL/INV/00566', 'FS/INV/00741',
  ],

  // Items for the following warehouses were not provided.
  // Add them via admin UI or a subsequent migration.
  'Food Studio Express Midnapore - FSRaC': [],
  'House Keeping - FSRaC': [],
  'Indian Kitchen - FSRaC': [],
  'Roll - China Town - FSRaC': [],
  'Staff Foods - FSRaC': [],
  'Tandoor Kitchen - FSRaC': [],
}

export class SeedFsracUsers20260317220000 implements MigrationInterface {
  name = 'SeedFsracUsers20260317220000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Resolve company from app_settings (falls back to 'Food Studio' if not yet configured)
    const [settings] = await queryRunner.query(
      `SELECT company FROM app_settings ORDER BY id LIMIT 1`,
    )
    const company: string = settings?.company ?? 'Food Studio'

    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10)

    for (const user of USERS) {
      // Insert user — skip if username already exists
      await queryRunner.query(
        `
        INSERT INTO users
          (username, full_name, email, password_hash, role, company,
           default_warehouse, source_warehouse, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
        ON CONFLICT (username) DO NOTHING
        `,
        [
          user.username,
          user.full_name,
          user.email,
          passwordHash,
          ROLE,
          company,
          user.warehouse,
          SOURCE_WAREHOUSE,
        ],
      )

      // Map user → warehouse (fetch the just-inserted or pre-existing user id)
      const [row] = await queryRunner.query(
        `SELECT id FROM users WHERE username = $1`,
        [user.username],
      )
      if (row) {
        await queryRunner.query(
          `
          INSERT INTO user_warehouses (user_id, warehouse)
          VALUES ($1, $2)
          ON CONFLICT (user_id, warehouse) DO NOTHING
          `,
          [row.id, user.warehouse],
        )
      }

      // Seed warehouse_items for this warehouse
      const items = WAREHOUSE_ITEMS[user.warehouse] ?? []
      if (items.length > 0) {
        // Deduplicate to avoid hitting the unique constraint
        const unique = [...new Set(items)]
        const placeholders = unique
          .map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`)
          .join(', ')
        const params = unique.flatMap((code) => [user.warehouse, code, company])
        await queryRunner.query(
          `INSERT INTO warehouse_items (warehouse, item_code, company)
           VALUES ${placeholders}
           ON CONFLICT DO NOTHING`,
          params,
        )
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const usernames = USERS.map((u) => u.username)
    const warehouses = USERS.map((u) => u.warehouse)

    // Remove warehouse_items seeded by this migration
    if (warehouses.length > 0) {
      const placeholders = warehouses.map((_, i) => `$${i + 1}`).join(', ')
      await queryRunner.query(
        `DELETE FROM warehouse_items WHERE warehouse IN (${placeholders})`,
        warehouses,
      )
    }

    // Remove users (user_warehouses rows are deleted via CASCADE)
    if (usernames.length > 0) {
      const placeholders = usernames.map((_, i) => `$${i + 1}`).join(', ')
      await queryRunner.query(
        `DELETE FROM users WHERE username IN (${placeholders})`,
        usernames,
      )
    }
  }
}
