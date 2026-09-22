import {
  Activity,
  ArrowDownToLine,
  ArrowDownUp,
  ArrowLeftRight,
  ArrowUpFromLine,
  Ban,
  BetweenHorizontalStart,
  Binary,
  Box,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleDot,
  CircleSlash,
  Clock,
  Combine,
  Database,
  Divide,
  Equal,
  FunctionSquare,
  Gauge,
  GitFork,
  Hand,
  Hash,
  Hourglass,
  Layers,
  Minimize2,
  Minus,
  PlugZap,
  Plus,
  RefreshCw,
  Repeat,
  Ruler,
  Scale,
  Slash,
  SlidersHorizontal,
  Split,
  Square,
  Timer,
  TimerOff,
  TrendingDown,
  TrendingUp,
  Waypoints,
  X,
  Zap,
} from 'lucide-react';
import type { ComponentType } from 'react';

/** Icon component shape used by the block metadata (lucide compatible). */
export type BlockIcon = ComponentType<{ size?: number | string; className?: string; strokeWidth?: number | string }>;

export interface BlockMeta {
  /** Internal block type. Never renamed — it is the persisted identifier. */
  type: string;
  /** Human readable title shown on cards, nodes, and the inspector header. */
  title: string;
  /** Library category. Order and membership match the persisted baseline. */
  category: string;
  summaryEn: string;
  summaryTh: string;
  icon: BlockIcon;
  /** Optional short badge, e.g. WRITE for blocks that can command a device. */
  badge?: string;
}

/**
 * Single source of truth for every block type in the library.
 *
 * It carries presentation data only (title, category, summaries, icon, badge).
 * Internal type identifiers, default parameters, runtime evaluation, and the
 * serialization format are untouched.
 */
export const BLOCK_METADATA: Record<string, BlockMeta> = {
  // --- Modbus -------------------------------------------------------------
  MODBUS_INPUT: {
    type: 'MODBUS_INPUT',
    title: 'MODBUS INPUT',
    category: 'Modbus',
    summaryEn: 'Reads a coil or register from a Modbus TCP device.',
    summaryTh: 'อ่านค่า Coil หรือ Register จากอุปกรณ์ Modbus TCP',
    icon: PlugZap,
    badge: 'READ',
  },
  MODBUS_MULTI_INPUT: {
    type: 'MODBUS_MULTI_INPUT',
    title: 'MODBUS MULTI INPUT',
    category: 'Modbus',
    summaryEn: 'Groups up to eight independent Modbus reads in one block.',
    summaryTh: 'รวมการอ่าน Modbus อิสระได้สูงสุด 8 รายการในบล็อกเดียว',
    icon: Layers,
    badge: 'MULTI',
  },
  MODBUS_OUTPUT: {
    type: 'MODBUS_OUTPUT',
    title: 'MODBUS OUTPUT',
    category: 'Modbus',
    summaryEn: 'Writes a command to a coil or register under the write policy.',
    summaryTh: 'เขียนคำสั่งไปยัง Coil หรือ Register ตามนโยบายความปลอดภัยการเขียน',
    icon: Zap,
    badge: 'WRITE',
  },

  // --- Boolean Logic ------------------------------------------------------
  AND: {
    type: 'AND',
    title: 'AND',
    category: 'Boolean Logic',
    summaryEn: 'TRUE only when every input is TRUE.',
    summaryTh: 'เป็น TRUE เมื่อทุกอินพุตเป็น TRUE เท่านั้น',
    icon: Combine,
  },
  OR: {
    type: 'OR',
    title: 'OR',
    category: 'Boolean Logic',
    summaryEn: 'TRUE when at least one input is TRUE.',
    summaryTh: 'เป็น TRUE เมื่อมีอินพุตอย่างน้อยหนึ่งตัวเป็น TRUE',
    icon: Split,
  },
  XOR: {
    type: 'XOR',
    title: 'XOR',
    category: 'Boolean Logic',
    summaryEn: 'TRUE when an odd number of inputs are TRUE.',
    summaryTh: 'เป็น TRUE เมื่อจำนวนอินพุตที่เป็น TRUE เป็นเลขคี่',
    icon: GitFork,
  },
  NAND: {
    type: 'NAND',
    title: 'NAND',
    category: 'Boolean Logic',
    summaryEn: 'Inverted AND — FALSE only when every input is TRUE.',
    summaryTh: 'กลับค่าจาก AND คือเป็น FALSE เมื่อทุกอินพุตเป็น TRUE',
    icon: Ban,
  },
  NOR: {
    type: 'NOR',
    title: 'NOR',
    category: 'Boolean Logic',
    summaryEn: 'Inverted OR — TRUE only when every input is FALSE.',
    summaryTh: 'กลับค่าจาก OR คือเป็น TRUE เมื่อทุกอินพุตเป็น FALSE',
    icon: CircleSlash,
  },
  NOT: {
    type: 'NOT',
    title: 'NOT',
    category: 'Boolean Logic',
    summaryEn: 'Inverts a single boolean input.',
    summaryTh: 'กลับค่าสัญญาณ Boolean หนึ่งช่อง',
    icon: Slash,
  },
  SR_LATCH: {
    type: 'SR_LATCH',
    title: 'SR LATCH',
    category: 'Boolean Logic',
    summaryEn: 'Set/Reset latch with configurable initial value.',
    summaryTh: 'วงจร Latch แบบ Set และ Reset พร้อมค่าเริ่มต้นที่กำหนดได้',
    icon: Box,
  },
  RS_LATCH: {
    type: 'RS_LATCH',
    title: 'RS LATCH',
    category: 'Boolean Logic',
    summaryEn: 'Reset/Set latch where Reset is evaluated first.',
    summaryTh: 'วงจร Latch แบบ Reset และ Set โดยให้ความสำคัญกับ Reset ก่อน',
    icon: Box,
  },
  RISING_EDGE: {
    type: 'RISING_EDGE',
    title: 'RISING EDGE',
    category: 'Boolean Logic',
    summaryEn: 'One scan TRUE when the input changes FALSE to TRUE.',
    summaryTh: 'ส่งค่า TRUE หนึ่งรอบเมื่ออินพุตเปลี่ยนจาก FALSE เป็น TRUE',
    icon: ArrowUpFromLine,
  },
  FALLING_EDGE: {
    type: 'FALLING_EDGE',
    title: 'FALLING EDGE',
    category: 'Boolean Logic',
    summaryEn: 'One scan TRUE when the input changes TRUE to FALSE.',
    summaryTh: 'ส่งค่า TRUE หนึ่งรอบเมื่ออินพุตเปลี่ยนจาก TRUE เป็น FALSE',
    icon: ArrowDownToLine,
  },

  // --- Compare ------------------------------------------------------------
  EQUAL: {
    type: 'EQUAL',
    title: 'EQUAL',
    category: 'Compare',
    summaryEn: 'TRUE when operand A equals operand B.',
    summaryTh: 'เป็น TRUE เมื่อค่า A เท่ากับค่า B',
    icon: Equal,
  },
  NOT_EQUAL: {
    type: 'NOT_EQUAL',
    title: 'NOT EQUAL',
    category: 'Compare',
    summaryEn: 'TRUE when operand A differs from operand B.',
    summaryTh: 'เป็น TRUE เมื่อค่า A ไม่เท่ากับค่า B',
    icon: CircleSlash,
  },
  GREATER_THAN: {
    type: 'GREATER_THAN',
    title: 'GREATER THAN',
    category: 'Compare',
    summaryEn: 'TRUE when operand A is greater than operand B.',
    summaryTh: 'เป็น TRUE เมื่อค่า A มากกว่าค่า B',
    icon: ChevronRight,
  },
  GREATER_EQUAL: {
    type: 'GREATER_EQUAL',
    title: 'GREATER EQUAL',
    category: 'Compare',
    summaryEn: 'TRUE when operand A is greater than or equal to operand B.',
    summaryTh: 'เป็น TRUE เมื่อค่า A มากกว่าหรือเท่ากับค่า B',
    icon: ChevronsRight,
  },
  LESS_THAN: {
    type: 'LESS_THAN',
    title: 'LESS THAN',
    category: 'Compare',
    summaryEn: 'TRUE when operand A is less than operand B.',
    summaryTh: 'เป็น TRUE เมื่อค่า A น้อยกว่าค่า B',
    icon: ChevronLeft,
  },
  LESS_EQUAL: {
    type: 'LESS_EQUAL',
    title: 'LESS EQUAL',
    category: 'Compare',
    summaryEn: 'TRUE when operand A is less than or equal to operand B.',
    summaryTh: 'เป็น TRUE เมื่อค่า A น้อยกว่าหรือเท่ากับค่า B',
    icon: ChevronsLeft,
  },
  IN_RANGE: {
    type: 'IN_RANGE',
    title: 'IN RANGE',
    category: 'Compare',
    summaryEn: 'TRUE while the value stays inside the configured limits.',
    summaryTh: 'เป็น TRUE เมื่อค่าอยู่ภายในขอบเขตล่างและขอบเขตบนที่กำหนด',
    icon: BetweenHorizontalStart,
  },
  OUT_OF_RANGE: {
    type: 'OUT_OF_RANGE',
    title: 'OUT OF RANGE',
    category: 'Compare',
    summaryEn: 'TRUE when the value leaves the configured limits.',
    summaryTh: 'เป็น TRUE เมื่อค่าหลุดออกจากขอบเขตที่กำหนด',
    icon: Waypoints,
  },

  // --- Math ---------------------------------------------------------------
  ADD: {
    type: 'ADD',
    title: 'ADD',
    category: 'Math',
    summaryEn: 'Sums every connected numeric input.',
    summaryTh: 'รวมค่าตัวเลขจากทุกอินพุตที่เชื่อมต่อ',
    icon: Plus,
  },
  SUBTRACT: {
    type: 'SUBTRACT',
    title: 'SUBTRACT',
    category: 'Math',
    summaryEn: 'Subtracts the second operand from the first.',
    summaryTh: 'ลบค่าตัวที่สองออกจากค่าตัวแรก',
    icon: Minus,
  },
  MULTIPLY: {
    type: 'MULTIPLY',
    title: 'MULTIPLY',
    category: 'Math',
    summaryEn: 'Multiplies every connected numeric input.',
    summaryTh: 'คูณค่าตัวเลขจากทุกอินพุตที่เชื่อมต่อ',
    icon: X,
  },
  DIVIDE: {
    type: 'DIVIDE',
    title: 'DIVIDE',
    category: 'Math',
    summaryEn: 'Divides the first operand by the second, guarding divide by zero.',
    summaryTh: 'หารค่าตัวแรกด้วยค่าตัวที่สอง พร้อมป้องกันตัวหารเป็นศูนย์',
    icon: Divide,
  },
  MINIMUM: {
    type: 'MINIMUM',
    title: 'MINIMUM',
    category: 'Math',
    summaryEn: 'Outputs the lowest value among the inputs.',
    summaryTh: 'ส่งออกค่าที่น้อยที่สุดจากอินพุตทั้งหมด',
    icon: TrendingDown,
  },
  MAXIMUM: {
    type: 'MAXIMUM',
    title: 'MAXIMUM',
    category: 'Math',
    summaryEn: 'Outputs the highest value among the inputs.',
    summaryTh: 'ส่งออกค่าที่มากที่สุดจากอินพุตทั้งหมด',
    icon: TrendingUp,
  },
  AVERAGE: {
    type: 'AVERAGE',
    title: 'AVERAGE',
    category: 'Math',
    summaryEn: 'Outputs the arithmetic mean of the inputs.',
    summaryTh: 'ส่งออกค่าเฉลี่ยเลขคณิตของอินพุตทั้งหมด',
    icon: Scale,
  },
  ABSOLUTE: {
    type: 'ABSOLUTE',
    title: 'ABSOLUTE',
    category: 'Math',
    summaryEn: 'Outputs the magnitude without the sign.',
    summaryTh: 'ส่งออกขนาดของค่าโดยไม่สนใจเครื่องหมาย',
    icon: FunctionSquare,
  },
  CLAMP: {
    type: 'CLAMP',
    title: 'CLAMP',
    category: 'Math',
    summaryEn: 'Limits a value between a minimum and a maximum.',
    summaryTh: 'จำกัดค่าให้อยู่ระหว่างค่าต่ำสุดและค่าสูงสุดที่กำหนด',
    icon: Minimize2,
  },
  LINEAR_MAPPING: {
    type: 'LINEAR_MAPPING',
    title: 'LINEAR MAPPING',
    category: 'Math',
    summaryEn: 'Calibrates an input range to an engineering output range.',
    summaryTh: 'ปรับเทียบช่วงค่าอินพุตให้เป็นช่วงค่าทางวิศวกรรม',
    icon: SlidersHorizontal,
  },
  SCALE: {
    type: 'SCALE',
    title: 'SCALE',
    category: 'Math',
    summaryEn: 'Multiplies the input by a scale factor.',
    summaryTh: 'คูณค่าอินพุตด้วยตัวคูณที่กำหนด',
    icon: Ruler,
  },
  OFFSET: {
    type: 'OFFSET',
    title: 'OFFSET',
    category: 'Math',
    summaryEn: 'Adds a fixed offset to the input value.',
    summaryTh: 'บวกค่าคงที่เข้าไปในค่าอินพุต',
    icon: ArrowDownUp,
  },

  // --- Timer --------------------------------------------------------------
  TON: {
    type: 'TON',
    title: 'TON',
    category: 'Timer',
    summaryEn: 'Delay on — output TRUE after the input stays TRUE.',
    summaryTh: 'หน่วงเวลาขาขึ้น ส่ง TRUE เมื่ออินพุตคงค่า TRUE ครบเวลาที่กำหนด',
    icon: Timer,
  },
  TOF: {
    type: 'TOF',
    title: 'TOF',
    category: 'Timer',
    summaryEn: 'Delay off — output stays TRUE for the set duration.',
    summaryTh: 'หน่วงเวลาขาลง คงค่า TRUE ต่ออีกตามเวลาที่กำหนด',
    icon: TimerOff,
  },
  PULSE: {
    type: 'PULSE',
    title: 'PULSE',
    category: 'Timer',
    summaryEn: 'Emits a fixed-length pulse on a rising input edge.',
    summaryTh: 'สร้างพัลส์ความยาวคงที่เมื่ออินพุตเปลี่ยนเป็น TRUE',
    icon: Activity,
  },
  DEBOUNCE: {
    type: 'DEBOUNCE',
    title: 'DEBOUNCE',
    category: 'Timer',
    summaryEn: 'Ignores input flicker shorter than the debounce time.',
    summaryTh: 'กรองสัญญาณกระพริบที่สั้นกว่าเวลาดีบาวซ์ที่กำหนด',
    icon: RefreshCw,
  },
  MIN_ON_TIME: {
    type: 'MIN_ON_TIME',
    title: 'MIN ON TIME',
    category: 'Timer',
    summaryEn: 'Keeps the output TRUE for a minimum duration.',
    summaryTh: 'บังคับให้เอาต์พุตคงค่า TRUE อย่างน้อยตามเวลาที่กำหนด',
    icon: Clock,
  },
  MIN_OFF_TIME: {
    type: 'MIN_OFF_TIME',
    title: 'MIN OFF TIME',
    category: 'Timer',
    summaryEn: 'Keeps the output FALSE for a minimum duration.',
    summaryTh: 'บังคับให้เอาต์พุตคงค่า FALSE อย่างน้อยตามเวลาที่กำหนด',
    icon: Hourglass,
  },

  // --- Utility ------------------------------------------------------------
  BOOLEAN_CONSTANT: {
    type: 'BOOLEAN_CONSTANT',
    title: 'BOOLEAN CONSTANT',
    category: 'Utility',
    summaryEn: 'Supplies a fixed TRUE or FALSE value.',
    summaryTh: 'จ่ายค่าคงที่แบบ TRUE หรือ FALSE',
    icon: CircleDot,
  },
  NUMERIC_CONSTANT: {
    type: 'NUMERIC_CONSTANT',
    title: 'NUMERIC CONSTANT',
    category: 'Utility',
    summaryEn: 'Supplies a fixed numeric value.',
    summaryTh: 'จ่ายค่าคงที่แบบตัวเลข',
    icon: Hash,
  },
  SELECTOR: {
    type: 'SELECTOR',
    title: 'SELECTOR',
    category: 'Utility',
    summaryEn: 'Routes data input A or B using a boolean selector.',
    summaryTh: 'เลือกส่งข้อมูลจากช่อง A หรือ B ตามสัญญาณ Boolean',
    icon: ArrowLeftRight,
  },
  MANUAL_TRIGGER: {
    type: 'MANUAL_TRIGGER',
    title: 'MANUAL TRIGGER',
    category: 'Utility',
    summaryEn: 'Operator command with momentary or latched trigger modes.',
    summaryTh: 'สั่งงานด้วยผู้ปฏิบัติงาน ทั้งแบบชั่วขณะและแบบค้างค่า',
    icon: Hand,
    badge: 'MANUAL',
  },
  MEMORY: {
    type: 'MEMORY',
    title: 'MEMORY',
    category: 'Utility',
    summaryEn: 'Retains a value across scans with an initial value policy.',
    summaryTh: 'เก็บค่าไว้ระหว่างรอบการทำงาน พร้อมนโยบายค่าเริ่มต้น',
    icon: Database,
    badge: 'STATE',
  },
  DATA_CONVERTER: {
    type: 'DATA_CONVERTER',
    title: 'DATA CONVERTER',
    category: 'Utility',
    summaryEn: 'Converts a value to another numeric or boolean data type.',
    summaryTh: 'แปลงค่าไปเป็นชนิดข้อมูลตัวเลขหรือ Boolean อื่น',
    icon: Repeat,
  },
  BIT_EXTRACT: {
    type: 'BIT_EXTRACT',
    title: 'BIT EXTRACT',
    category: 'Utility',
    summaryEn: 'Reads one bit or a bit field from an integer.',
    summaryTh: 'อ่านค่าบิตหรือกลุ่มบิตจากจำนวนเต็ม',
    icon: Binary,
  },
  BIT_COMBINE: {
    type: 'BIT_COMBINE',
    title: 'BIT COMBINE',
    category: 'Utility',
    summaryEn: 'Builds an integer from multiple boolean inputs.',
    summaryTh: 'ประกอบจำนวนเต็มจากอินพุต Boolean หลายช่อง',
    icon: Combine,
  },
  RATE_LIMITER: {
    type: 'RATE_LIMITER',
    title: 'RATE LIMITER',
    category: 'Utility',
    summaryEn: 'Limits how fast a value may change per time basis.',
    summaryTh: 'จำกัดอัตราการเปลี่ยนแปลงค่าต่อฐานเวลาที่กำหนด',
    icon: Gauge,
    badge: 'LIMIT',
  },
};

/** Category order shown in the library. Matches the baseline ordering. */
export const BLOCK_CATEGORY_ORDER: string[] = ['Modbus', 'Boolean Logic', 'Compare', 'Math', 'Timer', 'Utility'];

/**
 * Library index derived from the metadata, preserving the baseline category
 * order and the baseline block order inside each category.
 */
export const LIB: Record<string, string[]> = (() => {
  const grouped: Record<string, string[]> = {};
  for (const category of BLOCK_CATEGORY_ORDER) grouped[category] = [];
  for (const type of Object.keys(BLOCK_METADATA)) {
    const category = BLOCK_METADATA[type]!.category;
    if (!grouped[category]) grouped[category] = [];
    grouped[category]!.push(type);
  }
  return Object.fromEntries(BLOCK_CATEGORY_ORDER.map((category) => [category, grouped[category] ?? []]));
})();

export const BLOCK_TYPE_COUNT = Object.keys(BLOCK_METADATA).length;

/** Metadata lookup with a defensive fallback for unknown persisted types. */
export function blockMeta(type: string): BlockMeta {
  return (
    BLOCK_METADATA[type] ?? {
      type,
      title: type.replaceAll('_', ' '),
      category: 'Utility',
      summaryEn: 'Block type without library metadata.',
      summaryTh: 'บล็อกที่ยังไม่มีคำอธิบายในคลังบล็อก',
      icon: Box,
    }
  );
}

/** Types rendered with the IEC gate glyph instead of a generic icon. */
export const GATE_SYMBOL_TYPES: ReadonlySet<string> = new Set([
  'AND',
  'OR',
  'XOR',
  'NAND',
  'NOR',
  'NOT',
  'SR_LATCH',
  'RS_LATCH',
  'RISING_EDGE',
  'FALLING_EDGE',
]);
