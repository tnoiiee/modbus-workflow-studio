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

/* --- port documentation -------------------------------------------------- */

/**
 * Documentation for one existing input or output port.
 *
 * `index` is the zero-based port index and matches the persisted handle id
 * (`in-<index>` / `out-<index>`). This file carries documentation only: handle
 * ids, handle types, port counts, port order, connection rules, runtime
 * evaluation, and serialization are untouched.
 */
export interface BlockPortDoc {
  /** Zero-based port index. Matches the persisted handle id. */
  index: number;
  labelEn: string;
  labelTh: string;
  dataType: string;
  behaviorEn: string;
  behaviorTh: string;
  semanticsEn?: string;
  semanticsTh?: string;
}

/** Template used when the operator adds ports beyond the documented entries. */
export interface BlockDynamicPorts {
  min: number;
  max: number;
  labelEn: string;
  labelTh: string;
  dataType: string;
  behaviorEn: string;
  behaviorTh: string;
  semanticsEn?: string;
  semanticsTh?: string;
}

export interface BlockPortDocs {
  inputs: BlockPortDoc[];
  outputs: BlockPortDoc[];
  /** Repeated-input pattern for blocks whose input count the operator can change. */
  dynamicInputs?: BlockDynamicPorts;
  /** Repeated-output pattern for blocks whose output count the operator can change. */
  dynamicOutputs?: BlockDynamicPorts;
}

/** A port documentation entry resolved to the actual port count of a node. */
export interface ResolvedPortDoc {
  index: number;
  labelEn: string;
  labelTh: string;
  dataType: string;
  behaviorEn: string;
  behaviorTh: string;
  semanticsEn?: string;
  semanticsTh?: string;
}

export interface ResolvedPortDocs {
  inputs: ResolvedPortDoc[];
  outputs: ResolvedPortDoc[];
}

/* Shared signal semantics so every port speaks the same vocabulary. */
const LEVEL: Pick<BlockPortDoc, 'semanticsEn' | 'semanticsTh'> = { semanticsEn: 'Level TRUE / FALSE', semanticsTh: 'ระดับ TRUE หรือ FALSE' };
const NUMERIC: Pick<BlockPortDoc, 'semanticsEn' | 'semanticsTh'> = { semanticsEn: 'Numeric level', semanticsTh: 'ระดับค่าตัวเลข' };
const PULSE_RISING: Pick<BlockPortDoc, 'semanticsEn' | 'semanticsTh'> = { semanticsEn: 'Rising-edge pulse', semanticsTh: 'พัลส์ขาขึ้น' };
const PULSE_FALLING: Pick<BlockPortDoc, 'semanticsEn' | 'semanticsTh'> = { semanticsEn: 'Falling-edge pulse', semanticsTh: 'พัลส์ขาลง' };
const ENABLE: Pick<BlockPortDoc, 'semanticsEn' | 'semanticsTh'> = { semanticsEn: 'Enable input', semanticsTh: 'อินพุตเปิดใช้งาน' };
const RESET: Pick<BlockPortDoc, 'semanticsEn' | 'semanticsTh'> = { semanticsEn: 'Reset input', semanticsTh: 'อินพุตรีเซ็ต' };
const TIMER_DONE: Pick<BlockPortDoc, 'semanticsEn' | 'semanticsTh'> = { semanticsEn: 'Timer done output', semanticsTh: 'เอาต์พุตครบเวลา' };
const QUALITY: Pick<BlockPortDoc, 'semanticsEn' | 'semanticsTh'> = { semanticsEn: 'Quality', semanticsTh: 'คุณภาพสัญญาณ' };

/**
 * Second input of the blocks whose limits come from parameters instead of a
 * second signal: the port exists and must be connected to pass validation.
 */
const RESERVED_INPUT: BlockPortDoc = {
  index: 1,
  labelEn: 'Reserved Input',
  labelTh: 'อินพุตสำรอง',
  dataType: 'Any',
  behaviorEn: 'Reserved second input. It must be connected to pass validation; the block evaluates IN 1 against its configured parameters.',
  behaviorTh: 'อินพุตสำรองตำแหน่งที่สอง ต้องเชื่อมต่อเพื่อผ่านการตรวจสอบความถูกต้อง โดยบล็อกประมวลผล IN 1 ด้วยพารามิเตอร์ที่กำหนดไว้',
  ...LEVEL,
};

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
  /** Documentation for every existing input and output port. */
  ports: BlockPortDocs;
}

/**
 * Single source of truth for every block type in the library.
 *
 * It carries presentation data only (title, category, summaries, icon, badge)
 * and port documentation. Internal type identifiers, default parameters,
 * runtime evaluation, and the serialization format are untouched.
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
    ports: {
      inputs: [],
      outputs: [
        {
          index: 0,
          labelEn: 'Read Value',
          labelTh: 'ค่าที่อ่านได้',
          dataType: 'Boolean or Number (configured Data Type)',
          behaviorEn: 'Scaled value read from the configured device address. Quality follows the Modbus read; a bad read applies the Bad Input Policy and the block keeps the last known value.',
          behaviorTh: 'ค่าที่อ่านจากที่อยู่ของอุปกรณ์หลังปรับสเกล คุณภาพขึ้นกับการอ่าน Modbus เมื่ออ่านผิดพลาดจะใช้นโยบาย Bad Input และบล็อกคงค่าสุดท้ายที่ทราบไว้',
          ...QUALITY,
        },
      ],
    },
  },
  MODBUS_MULTI_INPUT: {
    type: 'MODBUS_MULTI_INPUT',
    title: 'MODBUS MULTI INPUT',
    category: 'Modbus',
    summaryEn: 'Groups up to eight independent Modbus reads in one block.',
    summaryTh: 'รวมการอ่าน Modbus อิสระได้สูงสุด 8 รายการในบล็อกเดียว',
    icon: Layers,
    badge: 'MULTI',
    ports: {
      inputs: [],
      outputs: [
        {
          index: 0,
          labelEn: 'Input 1 Value',
          labelTh: 'ค่าของอินพุต 1',
          dataType: 'Boolean or Number (per configured input)',
          behaviorEn: 'Scaled value of the first configured Modbus input. Quality follows that input read.',
          behaviorTh: 'ค่าที่อ่านและปรับสเกลของ Modbus Input รายการแรก คุณภาพขึ้นกับการอ่านของรายการนั้น',
          ...QUALITY,
        },
        {
          index: 1,
          labelEn: 'Input 2 Value',
          labelTh: 'ค่าของอินพุต 2',
          dataType: 'Boolean or Number (per configured input)',
          behaviorEn: 'Scaled value of the second configured Modbus input. Quality follows that input read.',
          behaviorTh: 'ค่าที่อ่านและปรับสเกลของ Modbus Input รายการที่สอง คุณภาพขึ้นกับการอ่านของรายการนั้น',
          ...QUALITY,
        },
      ],
      dynamicOutputs: {
        min: 1,
        max: 8,
        labelEn: 'Input',
        labelTh: 'อินพุต',
        dataType: 'Boolean or Number (per configured input)',
        behaviorEn: 'Scaled value of this configured Modbus input. Quality follows that input read.',
        behaviorTh: 'ค่าที่อ่านและปรับสเกลของ Modbus Input รายการนี้ คุณภาพขึ้นกับการอ่านของรายการนั้น',
        ...QUALITY,
      },
    },
  },
  MODBUS_OUTPUT: {
    type: 'MODBUS_OUTPUT',
    title: 'MODBUS OUTPUT',
    category: 'Modbus',
    summaryEn: 'Writes a command to a coil or register under the write policy.',
    summaryTh: 'เขียนคำสั่งไปยัง Coil หรือ Register ตามนโยบายความปลอดภัยการเขียน',
    icon: Zap,
    badge: 'WRITE',
    ports: {
      inputs: [
        {
          index: 0,
          labelEn: 'Command Value',
          labelTh: 'ค่าคำสั่ง',
          dataType: 'Boolean or Number (configured Data Type)',
          behaviorEn: 'Level value commanded to the device. The write guard, write-on-change, and ownership rules decide when it actually reaches the device.',
          behaviorTh: 'ค่าระดับที่สั่งไปยังอุปกรณ์ การเขียนจริงถูกควบคุมด้วย Write Guard, เขียนเมื่อค่าเปลี่ยน และกฎความเป็นเจ้าของ',
          ...LEVEL,
        },
      ],
      outputs: [],
    },
  },

  // --- Boolean Logic ------------------------------------------------------
  AND: {
    type: 'AND',
    title: 'AND',
    category: 'Boolean Logic',
    summaryEn: 'TRUE only when every input is TRUE.',
    summaryTh: 'เป็น TRUE เมื่อทุกอินพุตเป็น TRUE เท่านั้น',
    icon: Combine,
    ports: {
      inputs: [
        { index: 0, labelEn: 'Input 1', labelTh: 'อินพุต 1', dataType: 'Boolean', behaviorEn: 'Boolean level input. TRUE contributes to the AND result; the result stays FALSE while this input is FALSE.', behaviorTh: 'อินพุตระดับ Boolean ค่า TRUE มีผลต่อผลลัพธ์ AND ผลลัพธ์จะเป็น FALSE ตราบใดที่อินพุตนี้เป็น FALSE', ...LEVEL },
        { index: 1, labelEn: 'Input 2', labelTh: 'อินพุต 2', dataType: 'Boolean', behaviorEn: 'Boolean level input. TRUE contributes to the AND result; the result stays FALSE while this input is FALSE.', behaviorTh: 'อินพุตระดับ Boolean ค่า TRUE มีผลต่อผลลัพธ์ AND ผลลัพธ์จะเป็น FALSE ตราบใดที่อินพุตนี้เป็น FALSE', ...LEVEL },
      ],
      outputs: [
        { index: 0, labelEn: 'AND Result', labelTh: 'ผลลัพธ์ AND', dataType: 'Boolean', behaviorEn: 'Boolean level output. TRUE only while every connected input is TRUE.', behaviorTh: 'เอาต์พุตระดับ Boolean เป็น TRUE เมื่อทุกอินพุตที่เชื่อมต่อเป็น TRUE เท่านั้น', ...LEVEL },
      ],
      dynamicInputs: {
        min: 2,
        max: 16,
        labelEn: 'Input',
        labelTh: 'อินพุต',
        dataType: 'Boolean',
        behaviorEn: 'Additional Boolean level input. It joins the same AND test; every input must be TRUE for the result to be TRUE.',
        behaviorTh: 'อินพุตระดับ Boolean ที่เพิ่มเข้ามา จะเข้าร่วมการทดสอบ AND เดียวกัน โดยทุกอินพุตต้องเป็น TRUE ผลลัพธ์จึงจะเป็น TRUE',
        ...LEVEL,
      },
    },
  },
  OR: {
    type: 'OR',
    title: 'OR',
    category: 'Boolean Logic',
    summaryEn: 'TRUE when at least one input is TRUE.',
    summaryTh: 'เป็น TRUE เมื่อมีอินพุตอย่างน้อยหนึ่งตัวเป็น TRUE',
    icon: Split,
    ports: {
      inputs: [
        { index: 0, labelEn: 'Input 1', labelTh: 'อินพุต 1', dataType: 'Boolean', behaviorEn: 'Boolean level input. The result becomes TRUE while this input is TRUE.', behaviorTh: 'อินพุตระดับ Boolean ผลลัพธ์จะเป็น TRUE ตราบใดที่อินพุตนี้เป็น TRUE', ...LEVEL },
        { index: 1, labelEn: 'Input 2', labelTh: 'อินพุต 2', dataType: 'Boolean', behaviorEn: 'Boolean level input. The result becomes TRUE while this input is TRUE.', behaviorTh: 'อินพุตระดับ Boolean ผลลัพธ์จะเป็น TRUE ตราบใดที่อินพุตนี้เป็น TRUE', ...LEVEL },
      ],
      outputs: [
        { index: 0, labelEn: 'OR Result', labelTh: 'ผลลัพธ์ OR', dataType: 'Boolean', behaviorEn: 'Boolean level output. TRUE while at least one connected input is TRUE.', behaviorTh: 'เอาต์พุตระดับ Boolean เป็น TRUE เมื่อมีอินพุตที่เชื่อมต่ออย่างน้อยหนึ่งตัวเป็น TRUE', ...LEVEL },
      ],
      dynamicInputs: {
        min: 2,
        max: 16,
        labelEn: 'Input',
        labelTh: 'อินพุต',
        dataType: 'Boolean',
        behaviorEn: 'Additional Boolean level input. It joins the same OR test; one TRUE input is enough for a TRUE result.',
        behaviorTh: 'อินพุตระดับ Boolean ที่เพิ่มเข้ามา จะเข้าร่วมการทดสอบ OR เดียวกัน เพียงหนึ่งอินพุตเป็น TRUE ผลลัพธ์ก็เป็น TRUE',
        ...LEVEL,
      },
    },
  },
  XOR: {
    type: 'XOR',
    title: 'XOR',
    category: 'Boolean Logic',
    summaryEn: 'TRUE when an odd number of inputs are TRUE.',
    summaryTh: 'เป็น TRUE เมื่อจำนวนอินพุตที่เป็น TRUE เป็นเลขคี่',
    icon: GitFork,
    ports: {
      inputs: [
        { index: 0, labelEn: 'Input 1', labelTh: 'อินพุต 1', dataType: 'Boolean', behaviorEn: 'Boolean level input. Every TRUE input flips the parity used by the XOR result.', behaviorTh: 'อินพุตระดับ Boolean ทุกอินพุตที่เป็น TRUE จะสลับความคี่คู่ที่ใช้คำนวณผลลัพธ์ XOR', ...LEVEL },
        { index: 1, labelEn: 'Input 2', labelTh: 'อินพุต 2', dataType: 'Boolean', behaviorEn: 'Boolean level input. Every TRUE input flips the parity used by the XOR result.', behaviorTh: 'อินพุตระดับ Boolean ทุกอินพุตที่เป็น TRUE จะสลับความคี่คู่ที่ใช้คำนวณผลลัพธ์ XOR', ...LEVEL },
      ],
      outputs: [
        { index: 0, labelEn: 'XOR Result', labelTh: 'ผลลัพธ์ XOR', dataType: 'Boolean', behaviorEn: 'Boolean level output. TRUE while an odd number of connected inputs are TRUE.', behaviorTh: 'เอาต์พุตระดับ Boolean เป็น TRUE เมื่อจำนวนอินพุตที่เชื่อมต่อและเป็น TRUE เป็นเลขคี่', ...LEVEL },
      ],
      dynamicInputs: {
        min: 2,
        max: 16,
        labelEn: 'Input',
        labelTh: 'อินพุต',
        dataType: 'Boolean',
        behaviorEn: 'Additional Boolean level input. It joins the same parity test; the result is TRUE for an odd number of TRUE inputs.',
        behaviorTh: 'อินพุตระดับ Boolean ที่เพิ่มเข้ามา จะเข้าร่วมการทดสอบความคี่คู่เดียวกัน ผลลัพธ์เป็น TRUE เมื่อจำนวนอินพุตที่เป็น TRUE เป็นเลขคี่',
        ...LEVEL,
      },
    },
  },
  NAND: {
    type: 'NAND',
    title: 'NAND',
    category: 'Boolean Logic',
    summaryEn: 'Inverted AND — FALSE only when every input is TRUE.',
    summaryTh: 'กลับค่าจาก AND คือเป็น FALSE เมื่อทุกอินพุตเป็น TRUE',
    icon: Ban,
    ports: {
      inputs: [
        { index: 0, labelEn: 'Input 1', labelTh: 'อินพุต 1', dataType: 'Boolean', behaviorEn: 'Boolean level input. The inverted result stays TRUE while this input is FALSE.', behaviorTh: 'อินพุตระดับ Boolean ผลลัพธ์ที่กลับค่าจะเป็น TRUE ตราบใดที่อินพุตนี้เป็น FALSE', ...LEVEL },
        { index: 1, labelEn: 'Input 2', labelTh: 'อินพุต 2', dataType: 'Boolean', behaviorEn: 'Boolean level input. The inverted result stays TRUE while this input is FALSE.', behaviorTh: 'อินพุตระดับ Boolean ผลลัพธ์ที่กลับค่าจะเป็น TRUE ตราบใดที่อินพุตนี้เป็น FALSE', ...LEVEL },
      ],
      outputs: [
        { index: 0, labelEn: 'NAND Result', labelTh: 'ผลลัพธ์ NAND', dataType: 'Boolean', behaviorEn: 'Boolean level output. FALSE only while every connected input is TRUE.', behaviorTh: 'เอาต์พุตระดับ Boolean เป็น FALSE เมื่อทุกอินพุตที่เชื่อมต่อเป็น TRUE เท่านั้น', ...LEVEL },
      ],
      dynamicInputs: {
        min: 2,
        max: 16,
        labelEn: 'Input',
        labelTh: 'อินพุต',
        dataType: 'Boolean',
        behaviorEn: 'Additional Boolean level input. It joins the same NAND test; the result is FALSE only when every input is TRUE.',
        behaviorTh: 'อินพุตระดับ Boolean ที่เพิ่มเข้ามา จะเข้าร่วมการทดสอบ NAND เดียวกัน ผลลัพธ์เป็น FALSE เมื่อทุกอินพุตเป็น TRUE เท่านั้น',
        ...LEVEL,
      },
    },
  },
  NOR: {
    type: 'NOR',
    title: 'NOR',
    category: 'Boolean Logic',
    summaryEn: 'Inverted OR — TRUE only when every input is FALSE.',
    summaryTh: 'กลับค่าจาก OR คือเป็น TRUE เมื่อทุกอินพุตเป็น FALSE',
    icon: CircleSlash,
    ports: {
      inputs: [
        { index: 0, labelEn: 'Input 1', labelTh: 'อินพุต 1', dataType: 'Boolean', behaviorEn: 'Boolean level input. The inverted result goes FALSE while this input is TRUE.', behaviorTh: 'อินพุตระดับ Boolean ผลลัพธ์ที่กลับค่าจะเป็น FALSE ตราบใดที่อินพุตนี้เป็น TRUE', ...LEVEL },
        { index: 1, labelEn: 'Input 2', labelTh: 'อินพุต 2', dataType: 'Boolean', behaviorEn: 'Boolean level input. The inverted result goes FALSE while this input is TRUE.', behaviorTh: 'อินพุตระดับ Boolean ผลลัพธ์ที่กลับค่าจะเป็น FALSE ตราบใดที่อินพุตนี้เป็น TRUE', ...LEVEL },
      ],
      outputs: [
        { index: 0, labelEn: 'NOR Result', labelTh: 'ผลลัพธ์ NOR', dataType: 'Boolean', behaviorEn: 'Boolean level output. TRUE only while every connected input is FALSE.', behaviorTh: 'เอาต์พุตระดับ Boolean เป็น TRUE เมื่อทุกอินพุตที่เชื่อมต่อเป็น FALSE เท่านั้น', ...LEVEL },
      ],
      dynamicInputs: {
        min: 2,
        max: 16,
        labelEn: 'Input',
        labelTh: 'อินพุต',
        dataType: 'Boolean',
        behaviorEn: 'Additional Boolean level input. It joins the same NOR test; the result is TRUE only when every input is FALSE.',
        behaviorTh: 'อินพุตระดับ Boolean ที่เพิ่มเข้ามา จะเข้าร่วมการทดสอบ NOR เดียวกัน ผลลัพธ์เป็น TRUE เมื่อทุกอินพุตเป็น FALSE เท่านั้น',
        ...LEVEL,
      },
    },
  },
  NOT: {
    type: 'NOT',
    title: 'NOT',
    category: 'Boolean Logic',
    summaryEn: 'Inverts a single boolean input.',
    summaryTh: 'กลับค่าสัญญาณ Boolean หนึ่งช่อง',
    icon: Slash,
    ports: {
      inputs: [
        { index: 0, labelEn: 'Signal Input', labelTh: 'อินพุตสัญญาณ', dataType: 'Boolean', behaviorEn: 'Boolean level input that is inverted by the block.', behaviorTh: 'อินพุตระดับ Boolean ที่บล็อกนำไปกลับค่า', ...LEVEL },
      ],
      outputs: [
        { index: 0, labelEn: 'Inverted Output', labelTh: 'เอาต์พุตที่กลับค่า', dataType: 'Boolean', behaviorEn: 'Boolean level output. TRUE while the input is FALSE and FALSE while the input is TRUE.', behaviorTh: 'เอาต์พุตระดับ Boolean เป็น TRUE เมื่ออินพุตเป็น FALSE และเป็น FALSE เมื่ออินพุตเป็น TRUE', ...LEVEL },
      ],
    },
  },
  SR_LATCH: {
    type: 'SR_LATCH',
    title: 'SR LATCH',
    category: 'Boolean Logic',
    summaryEn: 'Set/Reset latch with configurable initial value.',
    summaryTh: 'วงจร Latch แบบ Set และ Reset พร้อมค่าเริ่มต้นที่กำหนดได้',
    icon: Box,
    ports: {
      inputs: [
        { index: 0, labelEn: 'Set Input', labelTh: 'อินพุตเซ็ต', dataType: 'Boolean', behaviorEn: 'Boolean level input. TRUE latches the output TRUE while Reset is FALSE.', behaviorTh: 'อินพุตระดับ Boolean ค่า TRUE จะล็อกเอาต์พุตเป็น TRUE เมื่อ Reset เป็น FALSE', ...LEVEL },
        { index: 1, labelEn: 'Reset Input', labelTh: 'อินพุตรีเซ็ต', dataType: 'Boolean', behaviorEn: 'Boolean level input. TRUE clears the output and wins over Set when both inputs are TRUE.', behaviorTh: 'อินพุตระดับ Boolean ค่า TRUE จะล้างเอาต์พุต และมีสิทธิเหนือ Set เมื่อทั้งสองอินพุตเป็น TRUE', ...RESET },
      ],
      outputs: [
        { index: 0, labelEn: 'Latch Output', labelTh: 'เอาต์พุตลatch', dataType: 'Boolean', behaviorEn: 'Boolean level output. Holds its last state until Set or Reset changes it.', behaviorTh: 'เอาต์พุตระดับ Boolean คงสถานะล่าสุดไว้จนกว่า Set หรือ Reset จะเปลี่ยนค่า', ...LEVEL },
      ],
    },
  },
  RS_LATCH: {
    type: 'RS_LATCH',
    title: 'RS LATCH',
    category: 'Boolean Logic',
    summaryEn: 'Reset/Set latch where Reset is evaluated first.',
    summaryTh: 'วงจร Latch แบบ Reset และ Set โดยให้ความสำคัญกับ Reset ก่อน',
    icon: Box,
    ports: {
      inputs: [
        { index: 0, labelEn: 'Reset Input', labelTh: 'อินพุตรีเซ็ต', dataType: 'Boolean', behaviorEn: 'Boolean level input evaluated first. TRUE clears the output regardless of Set.', behaviorTh: 'อินพุตระดับ Boolean ที่ประมวลผลก่อน ค่า TRUE จะล้างเอาต์พุตไม่ว่า Set จะเป็นใด', ...RESET },
        { index: 1, labelEn: 'Set Input', labelTh: 'อินพุตเซ็ต', dataType: 'Boolean', behaviorEn: 'Boolean level input. TRUE latches the output TRUE while Reset is FALSE.', behaviorTh: 'อินพุตระดับ Boolean ค่า TRUE จะล็อกเอาต์พุตเป็น TRUE เมื่อ Reset เป็น FALSE', ...LEVEL },
      ],
      outputs: [
        { index: 0, labelEn: 'Latch Output', labelTh: 'เอาต์พุตลatch', dataType: 'Boolean', behaviorEn: 'Boolean level output. Holds its last state until Reset or Set changes it.', behaviorTh: 'เอาต์พุตระดับ Boolean คงสถานะล่าสุดไว้จนกว่า Reset หรือ Set จะเปลี่ยนค่า', ...LEVEL },
      ],
    },
  },
  RISING_EDGE: {
    type: 'RISING_EDGE',
    title: 'RISING EDGE',
    category: 'Boolean Logic',
    summaryEn: 'One scan TRUE when the input changes FALSE to TRUE.',
    summaryTh: 'ส่งค่า TRUE หนึ่งรอบเมื่ออินพุตเปลี่ยนจาก FALSE เป็น TRUE',
    icon: ArrowUpFromLine,
    ports: {
      inputs: [
        { index: 0, labelEn: 'Signal Input', labelTh: 'อินพุตสัญญาณ', dataType: 'Boolean', behaviorEn: 'Boolean level input watched for a FALSE to TRUE change.', behaviorTh: 'อินพุตระดับ Boolean ที่ตรวจจับการเปลี่ยนจาก FALSE เป็น TRUE', ...LEVEL },
      ],
      outputs: [
        { index: 0, labelEn: 'Rising Edge Pulse', labelTh: 'พัลส์ขาขึ้น', dataType: 'Boolean', behaviorEn: 'One-scan TRUE pulse when the input changes from FALSE to TRUE, then FALSE again.', behaviorTh: 'พัลส์ TRUE หนึ่งรอบการทำงานเมื่ออินพุตเปลี่ยนจาก FALSE เป็น TRUE จากนั้นกลับเป็น FALSE', ...PULSE_RISING },
      ],
    },
  },
  FALLING_EDGE: {
    type: 'FALLING_EDGE',
    title: 'FALLING EDGE',
    category: 'Boolean Logic',
    summaryEn: 'One scan TRUE when the input changes TRUE to FALSE.',
    summaryTh: 'ส่งค่า TRUE หนึ่งรอบเมื่ออินพุตเปลี่ยนจาก TRUE เป็น FALSE',
    icon: ArrowDownToLine,
    ports: {
      inputs: [
        { index: 0, labelEn: 'Signal Input', labelTh: 'อินพุตสัญญาณ', dataType: 'Boolean', behaviorEn: 'Boolean level input watched for a TRUE to FALSE change.', behaviorTh: 'อินพุตระดับ Boolean ที่ตรวจจับการเปลี่ยนจาก TRUE เป็น FALSE', ...LEVEL },
      ],
      outputs: [
        { index: 0, labelEn: 'Falling Edge Pulse', labelTh: 'พัลส์ขาลง', dataType: 'Boolean', behaviorEn: 'One-scan TRUE pulse when the input changes from TRUE to FALSE, then FALSE again.', behaviorTh: 'พัลส์ TRUE หนึ่งรอบการทำงานเมื่ออินพุตเปลี่ยนจาก TRUE เป็น FALSE จากนั้นกลับเป็น FALSE', ...PULSE_FALLING },
      ],
    },
  },

  // --- Compare ------------------------------------------------------------
  EQUAL: {
    type: 'EQUAL',
    title: 'EQUAL',
    category: 'Compare',
    summaryEn: 'TRUE when operand A equals operand B.',
    summaryTh: 'เป็น TRUE เมื่อค่า A เท่ากับค่า B',
    icon: Equal,
    ports: {
      inputs: [
        { index: 0, labelEn: 'Operand A', labelTh: 'ตัวถูกดำเนินการ A', dataType: 'Number or Boolean', behaviorEn: 'First value of the comparison.', behaviorTh: 'ค่าตัวแรกที่ใช้ในการเปรียบเทียบ', ...LEVEL },
        { index: 1, labelEn: 'Operand B', labelTh: 'ตัวถูกดำเนินการ B', dataType: 'Number or Boolean', behaviorEn: 'Second value compared against Operand A.', behaviorTh: 'ค่าตัวที่สองที่นำมาเปรียบเทียบกับตัวถูกดำเนินการ A', ...LEVEL },
      ],
      outputs: [
        { index: 0, labelEn: 'Comparison Result', labelTh: 'ผลการเปรียบเทียบ', dataType: 'Boolean', behaviorEn: 'Boolean level output. TRUE while Operand A equals Operand B.', behaviorTh: 'เอาต์พุตระดับ Boolean เป็น TRUE เมื่อตัวถูกดำเนินการ A เท่ากับ B', ...LEVEL },
      ],
    },
  },
  NOT_EQUAL: {
    type: 'NOT_EQUAL',
    title: 'NOT EQUAL',
    category: 'Compare',
    summaryEn: 'TRUE when operand A differs from operand B.',
    summaryTh: 'เป็น TRUE เมื่อค่า A ไม่เท่ากับค่า B',
    icon: CircleSlash,
    ports: {
      inputs: [
        { index: 0, labelEn: 'Operand A', labelTh: 'ตัวถูกดำเนินการ A', dataType: 'Number or Boolean', behaviorEn: 'First value of the comparison.', behaviorTh: 'ค่าตัวแรกที่ใช้ในการเปรียบเทียบ', ...LEVEL },
        { index: 1, labelEn: 'Operand B', labelTh: 'ตัวถูกดำเนินการ B', dataType: 'Number or Boolean', behaviorEn: 'Second value compared against Operand A.', behaviorTh: 'ค่าตัวที่สองที่นำมาเปรียบเทียบกับตัวถูกดำเนินการ A', ...LEVEL },
      ],
      outputs: [
        { index: 0, labelEn: 'Comparison Result', labelTh: 'ผลการเปรียบเทียบ', dataType: 'Boolean', behaviorEn: 'Boolean level output. TRUE while Operand A differs from Operand B.', behaviorTh: 'เอาต์พุตระดับ Boolean เป็น TRUE เมื่อตัวถูกดำเนินการ A ไม่เท่ากับ B', ...LEVEL },
      ],
    },
  },
  GREATER_THAN: {
    type: 'GREATER_THAN',
    title: 'GREATER THAN',
    category: 'Compare',
    summaryEn: 'TRUE when operand A is greater than operand B.',
    summaryTh: 'เป็น TRUE เมื่อค่า A มากกว่าค่า B',
    icon: ChevronRight,
    ports: {
      inputs: [
        { index: 0, labelEn: 'Operand A', labelTh: 'ตัวถูกดำเนินการ A', dataType: 'Number', behaviorEn: 'Value tested as the left side of the comparison.', behaviorTh: 'ค่าที่ทดสอบในฝั่งซ้ายของการเปรียบเทียบ', ...NUMERIC },
        { index: 1, labelEn: 'Operand B', labelTh: 'ตัวถูกดำเนินการ B', dataType: 'Number', behaviorEn: 'Value that Operand A is compared against.', behaviorTh: 'ค่าที่นำมาเปรียบเทียบกับตัวถูกดำเนินการ A', ...NUMERIC },
      ],
      outputs: [
        { index: 0, labelEn: 'Comparison Result', labelTh: 'ผลการเปรียบเทียบ', dataType: 'Boolean', behaviorEn: 'Boolean level output. TRUE while Operand A is greater than Operand B.', behaviorTh: 'เอาต์พุตระดับ Boolean เป็น TRUE เมื่อตัวถูกดำเนินการ A มากกว่า B', ...LEVEL },
      ],
    },
  },
  GREATER_EQUAL: {
    type: 'GREATER_EQUAL',
    title: 'GREATER EQUAL',
    category: 'Compare',
    summaryEn: 'TRUE when operand A is greater than or equal to operand B.',
    summaryTh: 'เป็น TRUE เมื่อค่า A มากกว่าหรือเท่ากับค่า B',
    icon: ChevronsRight,
    ports: {
      inputs: [
        { index: 0, labelEn: 'Operand A', labelTh: 'ตัวถูกดำเนินการ A', dataType: 'Number', behaviorEn: 'Value tested as the left side of the comparison.', behaviorTh: 'ค่าที่ทดสอบในฝั่งซ้ายของการเปรียบเทียบ', ...NUMERIC },
        { index: 1, labelEn: 'Operand B', labelTh: 'ตัวถูกดำเนินการ B', dataType: 'Number', behaviorEn: 'Value that Operand A is compared against.', behaviorTh: 'ค่าที่นำมาเปรียบเทียบกับตัวถูกดำเนินการ A', ...NUMERIC },
      ],
      outputs: [
        { index: 0, labelEn: 'Comparison Result', labelTh: 'ผลการเปรียบเทียบ', dataType: 'Boolean', behaviorEn: 'Boolean level output. TRUE while Operand A is greater than or equal to Operand B.', behaviorTh: 'เอาต์พุตระดับ Boolean เป็น TRUE เมื่อตัวถูกดำเนินการ A มากกว่าหรือเท่ากับ B', ...LEVEL },
      ],
    },
  },
  LESS_THAN: {
    type: 'LESS_THAN',
    title: 'LESS THAN',
    category: 'Compare',
    summaryEn: 'TRUE when operand A is less than operand B.',
    summaryTh: 'เป็น TRUE เมื่อค่า A น้อยกว่าค่า B',
    icon: ChevronLeft,
    ports: {
      inputs: [
        { index: 0, labelEn: 'Operand A', labelTh: 'ตัวถูกดำเนินการ A', dataType: 'Number', behaviorEn: 'Value tested as the left side of the comparison.', behaviorTh: 'ค่าที่ทดสอบในฝั่งซ้ายของการเปรียบเทียบ', ...NUMERIC },
        { index: 1, labelEn: 'Operand B', labelTh: 'ตัวถูกดำเนินการ B', dataType: 'Number', behaviorEn: 'Value that Operand A is compared against.', behaviorTh: 'ค่าที่นำมาเปรียบเทียบกับตัวถูกดำเนินการ A', ...NUMERIC },
      ],
      outputs: [
        { index: 0, labelEn: 'Comparison Result', labelTh: 'ผลการเปรียบเทียบ', dataType: 'Boolean', behaviorEn: 'Boolean level output. TRUE while Operand A is less than Operand B.', behaviorTh: 'เอาต์พุตระดับ Boolean เป็น TRUE เมื่อตัวถูกดำเนินการ A น้อยกว่า B', ...LEVEL },
      ],
    },
  },
  LESS_EQUAL: {
    type: 'LESS_EQUAL',
    title: 'LESS EQUAL',
    category: 'Compare',
    summaryEn: 'TRUE when operand A is less than or equal to operand B.',
    summaryTh: 'เป็น TRUE เมื่อค่า A น้อยกว่าหรือเท่ากับค่า B',
    icon: ChevronsLeft,
    ports: {
      inputs: [
        { index: 0, labelEn: 'Operand A', labelTh: 'ตัวถูกดำเนินการ A', dataType: 'Number', behaviorEn: 'Value tested as the left side of the comparison.', behaviorTh: 'ค่าที่ทดสอบในฝั่งซ้ายของการเปรียบเทียบ', ...NUMERIC },
        { index: 1, labelEn: 'Operand B', labelTh: 'ตัวถูกดำเนินการ B', dataType: 'Number', behaviorEn: 'Value that Operand A is compared against.', behaviorTh: 'ค่าที่นำมาเปรียบเทียบกับตัวถูกดำเนินการ A', ...NUMERIC },
      ],
      outputs: [
        { index: 0, labelEn: 'Comparison Result', labelTh: 'ผลการเปรียบเทียบ', dataType: 'Boolean', behaviorEn: 'Boolean level output. TRUE while Operand A is less than or equal to Operand B.', behaviorTh: 'เอาต์พุตระดับ Boolean เป็น TRUE เมื่อตัวถูกดำเนินการ A น้อยกว่าหรือเท่ากับ B', ...LEVEL },
      ],
    },
  },
  IN_RANGE: {
    type: 'IN_RANGE',
    title: 'IN RANGE',
    category: 'Compare',
    summaryEn: 'TRUE while the value stays inside the configured limits.',
    summaryTh: 'เป็น TRUE เมื่อค่าอยู่ภายในขอบเขตล่างและขอบเขตบนที่กำหนด',
    icon: BetweenHorizontalStart,
    ports: {
      inputs: [
        { index: 0, labelEn: 'Value Input', labelTh: 'อินพุตค่า', dataType: 'Number', behaviorEn: 'Numeric level input tested against the configured Minimum and Maximum, both limits included.', behaviorTh: 'อินพุตระดับตัวเลขที่ทดสอบกับค่า Minimum และ Maximum ที่กำหนด โดยรวมค่าขอบเขตทั้งสอง', ...NUMERIC },
        RESERVED_INPUT,
      ],
      outputs: [
        { index: 0, labelEn: 'In Range Result', labelTh: 'ผลการอยู่ในช่วง', dataType: 'Boolean', behaviorEn: 'Boolean level output. TRUE while the value is inside the configured limits.', behaviorTh: 'เอาต์พุตระดับ Boolean เป็น TRUE เมื่อค่าอยู่ภายในขอบเขตที่กำหนด', ...LEVEL },
      ],
    },
  },
  OUT_OF_RANGE: {
    type: 'OUT_OF_RANGE',
    title: 'OUT OF RANGE',
    category: 'Compare',
    summaryEn: 'TRUE when the value leaves the configured limits.',
    summaryTh: 'เป็น TRUE เมื่อค่าหลุดออกจากขอบเขตที่กำหนด',
    icon: Waypoints,
    ports: {
      inputs: [
        { index: 0, labelEn: 'Value Input', labelTh: 'อินพุตค่า', dataType: 'Number', behaviorEn: 'Numeric level input tested against the configured Minimum and Maximum, both limits included.', behaviorTh: 'อินพุตระดับตัวเลขที่ทดสอบกับค่า Minimum และ Maximum ที่กำหนด โดยรวมค่าขอบเขตทั้งสอง', ...NUMERIC },
        RESERVED_INPUT,
      ],
      outputs: [
        { index: 0, labelEn: 'Out of Range Result', labelTh: 'ผลการหลุดออกจากช่วง', dataType: 'Boolean', behaviorEn: 'Boolean level output. TRUE while the value is outside the configured limits.', behaviorTh: 'เอาต์พุตระดับ Boolean เป็น TRUE เมื่อค่าอยู่นอกขอบเขตที่กำหนด', ...LEVEL },
      ],
    },
  },

  // --- Math ---------------------------------------------------------------
  ADD: {
    type: 'ADD',
    title: 'ADD',
    category: 'Math',
    summaryEn: 'Sums every connected numeric input.',
    summaryTh: 'รวมค่าตัวเลขจากทุกอินพุตที่เชื่อมต่อ',
    icon: Plus,
    ports: {
      inputs: [
        { index: 0, labelEn: 'Addend A', labelTh: 'ตัวบวก A', dataType: 'Number', behaviorEn: 'Numeric level input added to the sum.', behaviorTh: 'อินพุตระดับตัวเลขที่นำไปบวกในผลรวม', ...NUMERIC },
        { index: 1, labelEn: 'Addend B', labelTh: 'ตัวบวก B', dataType: 'Number', behaviorEn: 'Numeric level input added to the sum.', behaviorTh: 'อินพุตระดับตัวเลขที่นำไปบวกในผลรวม', ...NUMERIC },
      ],
      outputs: [
        { index: 0, labelEn: 'Sum', labelTh: 'ผลรวม', dataType: 'Number', behaviorEn: 'Numeric output with the total of the connected inputs.', behaviorTh: 'เอาต์พุตตัวเลขที่เป็นผลรวมของอินพุตที่เชื่อมต่อ', ...NUMERIC },
      ],
    },
  },
  SUBTRACT: {
    type: 'SUBTRACT',
    title: 'SUBTRACT',
    category: 'Math',
    summaryEn: 'Subtracts the second operand from the first.',
    summaryTh: 'ลบค่าตัวที่สองออกจากค่าตัวแรก',
    icon: Minus,
    ports: {
      inputs: [
        { index: 0, labelEn: 'Minuend A', labelTh: 'ตัวตั้งลบ A', dataType: 'Number', behaviorEn: 'Numeric level input the second operand is subtracted from.', behaviorTh: 'อินพุตระดับตัวเลขที่เป็นตัวตั้งสำหรับการลบ', ...NUMERIC },
        { index: 1, labelEn: 'Subtrahend B', labelTh: 'ตัวลบ B', dataType: 'Number', behaviorEn: 'Numeric level input subtracted from Operand A.', behaviorTh: 'อินพุตระดับตัวเลขที่นำไปลบออกจากตัวถูกดำเนินการ A', ...NUMERIC },
      ],
      outputs: [
        { index: 0, labelEn: 'Difference', labelTh: 'ผลลบ', dataType: 'Number', behaviorEn: 'Numeric output with the result of Operand A minus Operand B.', behaviorTh: 'เอาต์พุตตัวเลขที่เป็นผลจากตัวถูกดำเนินการ A ลบด้วย B', ...NUMERIC },
      ],
    },
  },
  MULTIPLY: {
    type: 'MULTIPLY',
    title: 'MULTIPLY',
    category: 'Math',
    summaryEn: 'Multiplies every connected numeric input.',
    summaryTh: 'คูณค่าตัวเลขจากทุกอินพุตที่เชื่อมต่อ',
    icon: X,
    ports: {
      inputs: [
        { index: 0, labelEn: 'Factor A', labelTh: 'ตัวประกอบ A', dataType: 'Number', behaviorEn: 'Numeric level input multiplied into the product.', behaviorTh: 'อินพุตระดับตัวเลขที่นำไปคูณในผลคูณ', ...NUMERIC },
        { index: 1, labelEn: 'Factor B', labelTh: 'ตัวประกอบ B', dataType: 'Number', behaviorEn: 'Numeric level input multiplied into the product.', behaviorTh: 'อินพุตระดับตัวเลขที่นำไปคูณในผลคูณ', ...NUMERIC },
      ],
      outputs: [
        { index: 0, labelEn: 'Product', labelTh: 'ผลคูณ', dataType: 'Number', behaviorEn: 'Numeric output with the product of the connected inputs.', behaviorTh: 'เอาต์พุตตัวเลขที่เป็นผลคูณของอินพุตที่เชื่อมต่อ', ...NUMERIC },
      ],
    },
  },
  DIVIDE: {
    type: 'DIVIDE',
    title: 'DIVIDE',
    category: 'Math',
    summaryEn: 'Divides the first operand by the second, guarding divide by zero.',
    summaryTh: 'หารค่าตัวแรกด้วยค่าตัวที่สอง พร้อมป้องกันตัวหารเป็นศูนย์',
    icon: Divide,
    ports: {
      inputs: [
        { index: 0, labelEn: 'Dividend A', labelTh: 'ตัวตั้งหาร A', dataType: 'Number', behaviorEn: 'Numeric level input that is divided.', behaviorTh: 'อินพุตระดับตัวเลขที่เป็นตัวตั้งสำหรับการหาร', ...NUMERIC },
        { index: 1, labelEn: 'Divisor B', labelTh: 'ตัวหาร B', dataType: 'Number', behaviorEn: 'Numeric level input that divides the dividend. A divisor of zero is guarded and produces NaN.', behaviorTh: 'อินพุตระดับตัวเลขที่ใช้หารตัวตั้ง เมื่อตัวหารเป็นศูนย์จะถูกป้องกันและให้ค่า NaN', ...NUMERIC },
      ],
      outputs: [
        { index: 0, labelEn: 'Quotient', labelTh: 'ผลหาร', dataType: 'Number', behaviorEn: 'Numeric output with the result of Operand A divided by Operand B, or NaN when the divisor is zero.', behaviorTh: 'เอาต์พุตตัวเลขที่เป็นผลจากตัวถูกดำเนินการ A หารด้วย B หรือเป็น NaN เมื่อตัวหารเป็นศูนย์', ...NUMERIC },
      ],
    },
  },
  MINIMUM: {
    type: 'MINIMUM',
    title: 'MINIMUM',
    category: 'Math',
    summaryEn: 'Outputs the lowest value among the inputs.',
    summaryTh: 'ส่งออกค่าที่น้อยที่สุดจากอินพุตทั้งหมด',
    icon: TrendingDown,
    ports: {
      inputs: [
        { index: 0, labelEn: 'Value A', labelTh: 'ค่า A', dataType: 'Number', behaviorEn: 'Numeric level input considered by the minimum test.', behaviorTh: 'อินพุตระดับตัวเลขที่นำมาเปรียบเทียบหาค่าต่ำสุด', ...NUMERIC },
        { index: 1, labelEn: 'Value B', labelTh: 'ค่า B', dataType: 'Number', behaviorEn: 'Numeric level input considered by the minimum test.', behaviorTh: 'อินพุตระดับตัวเลขที่นำมาเปรียบเทียบหาค่าต่ำสุด', ...NUMERIC },
      ],
      outputs: [
        { index: 0, labelEn: 'Minimum', labelTh: 'ค่าต่ำสุด', dataType: 'Number', behaviorEn: 'Numeric output with the lowest connected input value.', behaviorTh: 'เอาต์พุตตัวเลขที่เป็นค่าต่ำสุดของอินพุตที่เชื่อมต่อ', ...NUMERIC },
      ],
    },
  },
  MAXIMUM: {
    type: 'MAXIMUM',
    title: 'MAXIMUM',
    category: 'Math',
    summaryEn: 'Outputs the highest value among the inputs.',
    summaryTh: 'ส่งออกค่าที่มากที่สุดจากอินพุตทั้งหมด',
    icon: TrendingUp,
    ports: {
      inputs: [
        { index: 0, labelEn: 'Value A', labelTh: 'ค่า A', dataType: 'Number', behaviorEn: 'Numeric level input considered by the maximum test.', behaviorTh: 'อินพุตระดับตัวเลขที่นำมาเปรียบเทียบหาค่าสูงสุด', ...NUMERIC },
        { index: 1, labelEn: 'Value B', labelTh: 'ค่า B', dataType: 'Number', behaviorEn: 'Numeric level input considered by the maximum test.', behaviorTh: 'อินพุตระดับตัวเลขที่นำมาเปรียบเทียบหาค่าสูงสุด', ...NUMERIC },
      ],
      outputs: [
        { index: 0, labelEn: 'Maximum', labelTh: 'ค่าสูงสุด', dataType: 'Number', behaviorEn: 'Numeric output with the highest connected input value.', behaviorTh: 'เอาต์พุตตัวเลขที่เป็นค่าสูงสุดของอินพุตที่เชื่อมต่อ', ...NUMERIC },
      ],
    },
  },
  AVERAGE: {
    type: 'AVERAGE',
    title: 'AVERAGE',
    category: 'Math',
    summaryEn: 'Outputs the arithmetic mean of the inputs.',
    summaryTh: 'ส่งออกค่าเฉลี่ยเลขคณิตของอินพุตทั้งหมด',
    icon: Scale,
    ports: {
      inputs: [
        { index: 0, labelEn: 'Value A', labelTh: 'ค่า A', dataType: 'Number', behaviorEn: 'Numeric level input included in the mean.', behaviorTh: 'อินพุตระดับตัวเลขที่นำมาคำนวณค่าเฉลี่ย', ...NUMERIC },
        { index: 1, labelEn: 'Value B', labelTh: 'ค่า B', dataType: 'Number', behaviorEn: 'Numeric level input included in the mean.', behaviorTh: 'อินพุตระดับตัวเลขที่นำมาคำนวณค่าเฉลี่ย', ...NUMERIC },
      ],
      outputs: [
        { index: 0, labelEn: 'Average', labelTh: 'ค่าเฉลี่ย', dataType: 'Number', behaviorEn: 'Numeric output with the arithmetic mean of the connected inputs.', behaviorTh: 'เอาต์พุตตัวเลขที่เป็นค่าเฉลี่ยเลขคณิตของอินพุตที่เชื่อมต่อ', ...NUMERIC },
      ],
    },
  },
  ABSOLUTE: {
    type: 'ABSOLUTE',
    title: 'ABSOLUTE',
    category: 'Math',
    summaryEn: 'Outputs the magnitude without the sign.',
    summaryTh: 'ส่งออกขนาดของค่าโดยไม่สนใจเครื่องหมาย',
    icon: FunctionSquare,
    ports: {
      inputs: [
        { index: 0, labelEn: 'Value Input', labelTh: 'อินพุตค่า', dataType: 'Number', behaviorEn: 'Numeric level input whose magnitude is taken.', behaviorTh: 'อินพุตระดับตัวเลขที่นำไปหาขนาดของค่า', ...NUMERIC },
      ],
      outputs: [
        { index: 0, labelEn: 'Magnitude', labelTh: 'ขนาดของค่า', dataType: 'Number', behaviorEn: 'Numeric output with the absolute value of the input.', behaviorTh: 'เอาต์พุตตัวเลขที่เป็นค่าสัมบูรณ์ของอินพุต', ...NUMERIC },
      ],
    },
  },
  CLAMP: {
    type: 'CLAMP',
    title: 'CLAMP',
    category: 'Math',
    summaryEn: 'Limits a value between a minimum and a maximum.',
    summaryTh: 'จำกัดค่าให้อยู่ระหว่างค่าต่ำสุดและค่าสูงสุดที่กำหนด',
    icon: Minimize2,
    ports: {
      inputs: [
        { index: 0, labelEn: 'Value Input', labelTh: 'อินพุตค่า', dataType: 'Number', behaviorEn: 'Numeric level input limited to the configured Minimum and Maximum.', behaviorTh: 'อินพุตระดับตัวเลขที่ถูกจำกัดด้วยค่า Minimum และ Maximum ที่กำหนด', ...NUMERIC },
        RESERVED_INPUT,
      ],
      outputs: [
        { index: 0, labelEn: 'Clamped Value', labelTh: 'ค่าที่ถูกจำกัด', dataType: 'Number', behaviorEn: 'Numeric output held inside the configured limits; values outside are held at the limit.', behaviorTh: 'เอาต์พุตตัวเลขที่ถูกกักไว้ภายในขอบเขตที่กำหนด ค่าที่เกินจะถูกตรึงไว้ที่ขอบเขต', ...NUMERIC },
      ],
    },
  },
  LINEAR_MAPPING: {
    type: 'LINEAR_MAPPING',
    title: 'LINEAR MAPPING',
    category: 'Math',
    summaryEn: 'Calibrates an input range to an engineering output range.',
    summaryTh: 'ปรับเทียบช่วงค่าอินพุตให้เป็นช่วงค่าทางวิศวกรรม',
    icon: SlidersHorizontal,
    ports: {
      inputs: [
        { index: 0, labelEn: 'Raw Value Input', labelTh: 'อินพุตค่าดิบ', dataType: 'Number', behaviorEn: 'Numeric level input mapped from the input span to the engineering output span. Out-of-range input follows the Out-of-range Policy and marks quality BAD or UNCERTAIN.', behaviorTh: 'อินพุตระดับตัวเลขที่ถูกแมปจากช่วงอินพุตไปยังช่วงเอาต์พุตทางวิศวกรรม ค่าที่อยู่นอกช่วงจะเป็นไปตามนโยบาย Out-of-range และกำหนดคุณภาพเป็น BAD หรือ UNCERTAIN', ...NUMERIC },
      ],
      outputs: [
        { index: 0, labelEn: 'Mapped Value', labelTh: 'ค่าที่แมปแล้ว', dataType: 'Number', behaviorEn: 'Numeric output in the engineering range. Quality follows the out-of-range and invalid-span policies.', behaviorTh: 'เอาต์พุตตัวเลขในช่วงทางวิศวกรรม คุณภาพขึ้นกับนโยบายเมื่ออยู่นอกช่วงและเมื่อช่วงสอบเทียบไม่ถูกต้อง', ...QUALITY },
      ],
    },
  },
  SCALE: {
    type: 'SCALE',
    title: 'SCALE',
    category: 'Math',
    summaryEn: 'Multiplies the input by a scale factor.',
    summaryTh: 'คูณค่าอินพุตด้วยตัวคูณที่กำหนด',
    icon: Ruler,
    ports: {
      inputs: [
        { index: 0, labelEn: 'Value Input', labelTh: 'อินพุตค่า', dataType: 'Number', behaviorEn: 'Numeric level input multiplied by the configured Scale Factor.', behaviorTh: 'อินพุตระดับตัวเลขที่นำไปคูณด้วยตัวคูณสเกลที่กำหนด', ...NUMERIC },
      ],
      outputs: [
        { index: 0, labelEn: 'Scaled Value', labelTh: 'ค่าที่ปรับสเกล', dataType: 'Number', behaviorEn: 'Numeric output with the input times the scale factor.', behaviorTh: 'เอาต์พุตตัวเลขที่เป็นอินพุตคูณด้วยตัวคูณสเกล', ...NUMERIC },
      ],
    },
  },
  OFFSET: {
    type: 'OFFSET',
    title: 'OFFSET',
    category: 'Math',
    summaryEn: 'Adds a fixed offset to the input value.',
    summaryTh: 'บวกค่าคงที่เข้าไปในค่าอินพุต',
    icon: ArrowDownUp,
    ports: {
      inputs: [
        { index: 0, labelEn: 'Value Input', labelTh: 'อินพุตค่า', dataType: 'Number', behaviorEn: 'Numeric level input the configured Offset Value is added to.', behaviorTh: 'อินพุตระดับตัวเลขที่นำไปบวกด้วยค่าออฟเซตที่กำหนด', ...NUMERIC },
      ],
      outputs: [
        { index: 0, labelEn: 'Offset Value Output', labelTh: 'ค่าหลังบวกออฟเซต', dataType: 'Number', behaviorEn: 'Numeric output with the input plus the configured offset.', behaviorTh: 'เอาต์พุตตัวเลขที่เป็นอินพุตบวกด้วยค่าออฟเซตที่กำหนด', ...NUMERIC },
      ],
    },
  },

  // --- Timer --------------------------------------------------------------
  TON: {
    type: 'TON',
    title: 'TON',
    category: 'Timer',
    summaryEn: 'Delay on — output TRUE after the input stays TRUE.',
    summaryTh: 'หน่วงเวลาขาขึ้น ส่ง TRUE เมื่ออินพุตคงค่า TRUE ครบเวลาที่กำหนด',
    icon: Timer,
    ports: {
      inputs: [
        { index: 0, labelEn: 'Timer Enable', labelTh: 'เปิดใช้งานตัวตั้งเวลา', dataType: 'Boolean', behaviorEn: 'Boolean level input that starts the delay. Returning it to FALSE restarts the timer.', behaviorTh: 'อินพุตระดับ Boolean ที่เริ่มการหน่วงเวลา การกลับเป็น FALSE จะเริ่มจับเวลาใหม่', ...ENABLE },
        RESERVED_INPUT,
      ],
      outputs: [
        { index: 0, labelEn: 'Timer Done', labelTh: 'ครบเวลา', dataType: 'Boolean', behaviorEn: 'Boolean level output. TRUE after the enable input has stayed TRUE for the preset duration.', behaviorTh: 'เอาต์พุตระดับ Boolean เป็น TRUE เมื่ออินพุตเปิดใช้งานคงค่า TRUE ครบเวลาที่กำหนด', ...TIMER_DONE },
      ],
    },
  },
  TOF: {
    type: 'TOF',
    title: 'TOF',
    category: 'Timer',
    summaryEn: 'Delay off — output stays TRUE for the set duration.',
    summaryTh: 'หน่วงเวลาขาลง คงค่า TRUE ต่ออีกตามเวลาที่กำหนด',
    icon: TimerOff,
    ports: {
      inputs: [
        { index: 0, labelEn: 'Timer Enable', labelTh: 'เปิดใช้งานตัวตั้งเวลา', dataType: 'Boolean', behaviorEn: 'Boolean level input. While it is TRUE the output follows it; when it goes FALSE the off delay starts.', behaviorTh: 'อินพุตระดับ Boolean ขณะเป็น TRUE เอาต์พุตจะตามอินพุต เมื่อกลับเป็น FALSE จะเริ่มหน่วงเวลาขาลง', ...ENABLE },
        RESERVED_INPUT,
      ],
      outputs: [
        { index: 0, labelEn: 'Timer Output', labelTh: 'เอาต์พุตตัวตั้งเวลา', dataType: 'Boolean', behaviorEn: 'Boolean level output. Stays TRUE while the input is TRUE and for the preset duration after it goes FALSE.', behaviorTh: 'เอาต์พุตระดับ Boolean คงเป็น TRUE ขณะอินพุตเป็น TRUE และต่ออีกตามเวลาที่กำหนดหลังอินพุตเป็น FALSE', ...TIMER_DONE },
      ],
    },
  },
  PULSE: {
    type: 'PULSE',
    title: 'PULSE',
    category: 'Timer',
    summaryEn: 'Emits a fixed-length pulse on a rising input edge.',
    summaryTh: 'สร้างพัลส์ความยาวคงที่เมื่ออินพุตเปลี่ยนเป็น TRUE',
    icon: Activity,
    ports: {
      inputs: [
        { index: 0, labelEn: 'Trigger Input', labelTh: 'อินพุตทริกเกอร์', dataType: 'Boolean', behaviorEn: 'Boolean level input. A FALSE to TRUE change starts one fixed-length pulse.', behaviorTh: 'อินพุตระดับ Boolean การเปลี่ยนจาก FALSE เป็น TRUE จะเริ่มพัลส์ความยาวคงที่หนึ่งครั้ง', ...PULSE_RISING },
        RESERVED_INPUT,
      ],
      outputs: [
        { index: 0, labelEn: 'Pulse Output', labelTh: 'เอาต์พุตพัลส์', dataType: 'Boolean', behaviorEn: 'Boolean output. TRUE for the preset duration after a rising input edge, then FALSE.', behaviorTh: 'เอาต์พุต Boolean เป็น TRUE ตามเวลาที่กำหนดหลังขอบขาขึ้นของอินพุต จากนั้นกลับเป็น FALSE', ...PULSE_RISING },
      ],
    },
  },
  DEBOUNCE: {
    type: 'DEBOUNCE',
    title: 'DEBOUNCE',
    category: 'Timer',
    summaryEn: 'Ignores input flicker shorter than the debounce time.',
    summaryTh: 'กรองสัญญาณกระพริบที่สั้นกว่าเวลาดีบาวซ์ที่กำหนด',
    icon: RefreshCw,
    ports: {
      inputs: [
        { index: 0, labelEn: 'Signal Input', labelTh: 'อินพุตสัญญาณ', dataType: 'Boolean', behaviorEn: 'Boolean level input. Changes shorter than the debounce time are ignored; a new change restarts the debounce time.', behaviorTh: 'อินพุตระดับ Boolean การเปลี่ยนแปลงที่สั้นกว่าเวลาดีบาวซ์จะถูกละเว้น และการเปลี่ยนใหม่จะเริ่มจับเวลาใหม่', ...LEVEL },
        RESERVED_INPUT,
      ],
      outputs: [
        { index: 0, labelEn: 'Debounced Output', labelTh: 'เอาต์พุตที่กรองแล้ว', dataType: 'Boolean', behaviorEn: 'Boolean level output. Follows the input only after it has been stable for the debounce time.', behaviorTh: 'เอาต์พุตระดับ Boolean จะตามอินพุตก็ต่อเมื่ออินพุตนิ่งครบเวลาดีบาวซ์', ...LEVEL },
      ],
    },
  },
  MIN_ON_TIME: {
    type: 'MIN_ON_TIME',
    title: 'MIN ON TIME',
    category: 'Timer',
    summaryEn: 'Keeps the output TRUE for a minimum duration.',
    summaryTh: 'บังคับให้เอาต์พุตคงค่า TRUE อย่างน้อยตามเวลาที่กำหนด',
    icon: Clock,
    ports: {
      inputs: [
        { index: 0, labelEn: 'Signal Input', labelTh: 'อินพุตสัญญาณ', dataType: 'Boolean', behaviorEn: 'Boolean level input. Turning it TRUE starts the minimum on time.', behaviorTh: 'อินพุตระดับ Boolean การเปลี่ยนเป็น TRUE จะเริ่มจับเวลาเปิดขั้นต่ำ', ...LEVEL },
        RESERVED_INPUT,
      ],
      outputs: [
        { index: 0, labelEn: 'Minimum On Output', labelTh: 'เอาต์พุตเปิดขั้นต่ำ', dataType: 'Boolean', behaviorEn: 'Boolean level output. Stays TRUE for at least the minimum on time once the input turns TRUE.', behaviorTh: 'เอาต์พุตระดับ Boolean คงเป็น TRUE อย่างน้อยตามเวลาเปิดขั้นต่ำเมื่ออินพุตเปลี่ยนเป็น TRUE', ...TIMER_DONE },
      ],
    },
  },
  MIN_OFF_TIME: {
    type: 'MIN_OFF_TIME',
    title: 'MIN OFF TIME',
    category: 'Timer',
    summaryEn: 'Keeps the output FALSE for a minimum duration.',
    summaryTh: 'บังคับให้เอาต์พุตคงค่า FALSE อย่างน้อยตามเวลาที่กำหนด',
    icon: Hourglass,
    ports: {
      inputs: [
        { index: 0, labelEn: 'Signal Input', labelTh: 'อินพุตสัญญาณ', dataType: 'Boolean', behaviorEn: 'Boolean level input. Turning it FALSE starts the minimum off time.', behaviorTh: 'อินพุตระดับ Boolean การเปลี่ยนเป็น FALSE จะเริ่มจับเวลาปิดขั้นต่ำ', ...LEVEL },
        RESERVED_INPUT,
      ],
      outputs: [
        { index: 0, labelEn: 'Minimum Off Output', labelTh: 'เอาต์พุตปิดขั้นต่ำ', dataType: 'Boolean', behaviorEn: 'Boolean level output. Stays FALSE for at least the minimum off time once the input turns FALSE.', behaviorTh: 'เอาต์พุตระดับ Boolean คงเป็น FALSE อย่างน้อยตามเวลาปิดขั้นต่ำเมื่ออินพุตเปลี่ยนเป็น FALSE', ...TIMER_DONE },
      ],
    },
  },

  // --- Utility ------------------------------------------------------------
  BOOLEAN_CONSTANT: {
    type: 'BOOLEAN_CONSTANT',
    title: 'BOOLEAN CONSTANT',
    category: 'Utility',
    summaryEn: 'Supplies a fixed TRUE or FALSE value.',
    summaryTh: 'จ่ายค่าคงที่แบบ TRUE หรือ FALSE',
    icon: CircleDot,
    ports: {
      inputs: [],
      outputs: [
        { index: 0, labelEn: 'Constant Value', labelTh: 'ค่าคงที่', dataType: 'Boolean', behaviorEn: 'Boolean level output with the configured constant. It never depends on an input, so its quality stays GOOD.', behaviorTh: 'เอาต์พุตระดับ Boolean ที่เป็นค่าคงที่ตามที่กำหนด ไม่ขึ้นกับอินพุตใด จึงมีคุณภาพเป็น GOOD เสมอ', ...LEVEL },
      ],
    },
  },
  NUMERIC_CONSTANT: {
    type: 'NUMERIC_CONSTANT',
    title: 'NUMERIC CONSTANT',
    category: 'Utility',
    summaryEn: 'Supplies a fixed numeric value.',
    summaryTh: 'จ่ายค่าคงที่แบบตัวเลข',
    icon: Hash,
    ports: {
      inputs: [],
      outputs: [
        { index: 0, labelEn: 'Constant Value', labelTh: 'ค่าคงที่', dataType: 'Number', behaviorEn: 'Numeric output with the configured constant. It never depends on an input, so its quality stays GOOD.', behaviorTh: 'เอาต์พุตตัวเลขที่เป็นค่าคงที่ตามที่กำหนด ไม่ขึ้นกับอินพุตใด จึงมีคุณภาพเป็น GOOD เสมอ', ...NUMERIC },
      ],
    },
  },
  SELECTOR: {
    type: 'SELECTOR',
    title: 'SELECTOR',
    category: 'Utility',
    summaryEn: 'Routes data input A or B using a boolean selector.',
    summaryTh: 'เลือกส่งข้อมูลจากช่อง A หรือ B ตามสัญญาณ Boolean',
    icon: ArrowLeftRight,
    ports: {
      inputs: [
        { index: 0, labelEn: 'Selector Input', labelTh: 'อินพุตตัวเลือก', dataType: 'Boolean', behaviorEn: 'Boolean level input that chooses the routed value: FALSE routes the value on IN 2, TRUE routes the value on the next data input.', behaviorTh: 'อินพุตระดับ Boolean ที่เลือกค่าที่จะส่งต่อ ค่า FALSE ส่งค่าจาก IN 2 และค่า TRUE ส่งค่าจากอินพุตข้อมูลถัดไป', ...LEVEL },
        { index: 1, labelEn: 'Data Input A', labelTh: 'อินพุตข้อมูล A', dataType: 'Number or Boolean', behaviorEn: 'Value routed to the output while the selector is FALSE.', behaviorTh: 'ค่าที่ถูกส่งไปยังเอาต์พุตขณะตัวเลือกเป็น FALSE', ...LEVEL },
      ],
      outputs: [
        { index: 0, labelEn: 'Selected Value', labelTh: 'ค่าที่ถูกเลือก', dataType: 'Number or Boolean', behaviorEn: 'Output with the value chosen by the selector input.', behaviorTh: 'เอาต์พุตที่เป็นค่าซึ่งถูกเลือกโดยอินพุตตัวเลือก', ...LEVEL },
      ],
    },
  },
  MANUAL_TRIGGER: {
    type: 'MANUAL_TRIGGER',
    title: 'MANUAL TRIGGER',
    category: 'Utility',
    summaryEn: 'Operator command with momentary or latched trigger modes.',
    summaryTh: 'สั่งงานด้วยผู้ปฏิบัติงาน ทั้งแบบชั่วขณะและแบบค้างค่า',
    icon: Hand,
    badge: 'MANUAL',
    ports: {
      inputs: [],
      outputs: [
        { index: 0, labelEn: 'Trigger Output', labelTh: 'เอาต์พุตทริกเกอร์', dataType: 'Boolean', behaviorEn: 'Boolean output driven by the operator command. Momentary mode stays TRUE while held; toggle and one-shot modes follow the configured trigger mode.', behaviorTh: 'เอาต์พุต Boolean ที่ควบคุมด้วยคำสั่งของผู้ปฏิบัติงาน โหมดชั่วขณะจะเป็น TRUE ขณะกดค้าง ส่วนโหมดสลับและครั้งเดียวจะเป็นไปตามที่กำหนด', ...LEVEL },
      ],
    },
  },
  MEMORY: {
    type: 'MEMORY',
    title: 'MEMORY',
    category: 'Utility',
    summaryEn: 'Retains a value across scans with an initial value policy.',
    summaryTh: 'เก็บค่าไว้ระหว่างรอบการทำงาน พร้อมนโยบายค่าเริ่มต้น',
    icon: Database,
    badge: 'STATE',
    ports: {
      inputs: [
        { index: 0, labelEn: 'Value Input', labelTh: 'อินพุตค่า', dataType: 'Number or Boolean', behaviorEn: 'Level value stored for the next scan. The output publishes the value retained from the previous scan.', behaviorTh: 'ค่าระดับที่ถูกเก็บไว้สำหรับรอบถัดไป โดยเอาต์พุตจะส่งค่าที่เก็บจากรอบก่อนหน้า', ...LEVEL },
      ],
      outputs: [
        { index: 0, labelEn: 'Stored Value', labelTh: 'ค่าที่เก็บไว้', dataType: 'Number or Boolean', behaviorEn: 'Output with the value retained from the previous scan, so the block delays the input by one scan.', behaviorTh: 'เอาต์พุตที่เป็นค่าที่เก็บจากรอบการทำงานก่อนหน้า ทำให้บล็อกหน่วงอินพุตไว้หนึ่งรอบ', ...LEVEL },
      ],
    },
  },
  DATA_CONVERTER: {
    type: 'DATA_CONVERTER',
    title: 'DATA CONVERTER',
    category: 'Utility',
    summaryEn: 'Converts a value to another numeric or boolean data type.',
    summaryTh: 'แปลงค่าไปเป็นชนิดข้อมูลตัวเลขหรือ Boolean อื่น',
    icon: Repeat,
    ports: {
      inputs: [
        { index: 0, labelEn: 'Value Input', labelTh: 'อินพุตค่า', dataType: 'Number or Boolean', behaviorEn: 'Level value converted to the configured target type.', behaviorTh: 'ค่าระดับที่ถูกแปลงไปเป็นชนิดข้อมูลเป้าหมายที่กำหนด', ...LEVEL },
      ],
      outputs: [
        { index: 0, labelEn: 'Converted Value', labelTh: 'ค่าที่แปลงแล้ว', dataType: 'Boolean or Number (configured target)', behaviorEn: 'Output with the input converted to the target data type.', behaviorTh: 'เอาต์พุตที่เป็นอินพุตหลังแปลงเป็นชนิดข้อมูลเป้าหมาย', ...LEVEL },
      ],
    },
  },
  BIT_EXTRACT: {
    type: 'BIT_EXTRACT',
    title: 'BIT EXTRACT',
    category: 'Utility',
    summaryEn: 'Reads one bit or a bit field from an integer.',
    summaryTh: 'อ่านค่าบิตหรือกลุ่มบิตจากจำนวนเต็ม',
    icon: Binary,
    ports: {
      inputs: [
        { index: 0, labelEn: 'Integer Input', labelTh: 'อินพุตจำนวนเต็ม', dataType: 'Number (integer)', behaviorEn: 'Numeric level input the configured bit index is read from.', behaviorTh: 'อินพุตระดับตัวเลขที่อ่านค่าตามตำแหน่งบิตที่กำหนด', ...NUMERIC },
      ],
      outputs: [
        { index: 0, labelEn: 'Extracted Bit', labelTh: 'บิตที่แยกได้', dataType: 'Boolean', behaviorEn: 'Boolean output with the state of the selected bit, counted from bit zero.', behaviorTh: 'เอาต์พุต Boolean ที่เป็นสถานะของบิตที่เลือก โดยนับจากบิตศูนย์', ...LEVEL },
      ],
    },
  },
  BIT_COMBINE: {
    type: 'BIT_COMBINE',
    title: 'BIT COMBINE',
    category: 'Utility',
    summaryEn: 'Builds an integer from multiple boolean inputs.',
    summaryTh: 'ประกอบจำนวนเต็มจากอินพุต Boolean หลายช่อง',
    icon: Combine,
    ports: {
      inputs: [
        { index: 0, labelEn: 'Bit 0 Input', labelTh: 'อินพุตบิต 0', dataType: 'Boolean', behaviorEn: 'Boolean level input written to bit zero of the combined integer.', behaviorTh: 'อินพุตระดับ Boolean ที่ถูกเขียนลงบิตศูนย์ของจำนวนเต็มที่ประกอบขึ้น', ...LEVEL },
        { index: 1, labelEn: 'Bit 1 Input', labelTh: 'อินพุตบิต 1', dataType: 'Boolean', behaviorEn: 'Boolean level input written to bit one of the combined integer.', behaviorTh: 'อินพุตระดับ Boolean ที่ถูกเขียนลงบิตที่หนึ่งของจำนวนเต็มที่ประกอบขึ้น', ...LEVEL },
      ],
      outputs: [
        { index: 0, labelEn: 'Combined Integer', labelTh: 'จำนวนเต็มที่ประกอบแล้ว', dataType: 'Number (integer)', behaviorEn: 'Numeric output with every TRUE input set in its matching bit position.', behaviorTh: 'เอาต์พุตตัวเลขที่ตั้งบิตตรงตำแหน่งของทุกอินพุตที่เป็น TRUE', ...NUMERIC },
      ],
    },
  },
  RATE_LIMITER: {
    type: 'RATE_LIMITER',
    title: 'RATE LIMITER',
    category: 'Utility',
    summaryEn: 'Limits how fast a value may change per time basis.',
    summaryTh: 'จำกัดอัตราการเปลี่ยนแปลงค่าต่อฐานเวลาที่กำหนด',
    icon: Gauge,
    badge: 'LIMIT',
    ports: {
      inputs: [
        { index: 0, labelEn: 'Value Input', labelTh: 'อินพุตค่า', dataType: 'Number', behaviorEn: 'Numeric level input whose change per scan is limited by the configured rate.', behaviorTh: 'อินพุตระดับตัวเลขที่อัตราการเปลี่ยนต่อรอบถูกจำกัดตามค่าที่กำหนด', ...NUMERIC },
      ],
      outputs: [
        { index: 0, labelEn: 'Rate Limited Value', labelTh: 'ค่าที่จำกัดอัตราแล้ว', dataType: 'Number', behaviorEn: 'Numeric output that follows the input only within the configured rate limit.', behaviorTh: 'เอาต์พุตตัวเลขที่ตามอินพุตได้เฉพาะภายในอัตราการเปลี่ยนแปลงที่กำหนด', ...NUMERIC },
      ],
    },
  },
};

/** Category order shown in the library. Matches the baseline ordering. */
export const BLOCK_CATEGORY_ORDER: string[] = ['Modbus', 'Boolean Logic', 'Compare', 'Math', 'Timer', 'Utility'];

/** Quality note rendered with the port documentation in the parameters panel. */
export const PORT_QUALITY_NOTE_EN =
  'When any input quality is not GOOD, the block output becomes UNCERTAIN and keeps its last known value until the inputs are GOOD again.';
export const PORT_QUALITY_NOTE_TH =
  'เมื่อคุณภาพของอินพุตใดไม่เป็น GOOD เอาต์พุตของบล็อกจะเป็น UNCERTAIN และคงค่าสุดท้ายที่ทราบไว้จนกว่าอินพุตจะกลับเป็น GOOD';

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

/** Documentation placeholder for block types without library metadata. */
const NO_PORTS: BlockPortDocs = { inputs: [], outputs: [] };

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
      ports: NO_PORTS,
    }
  );
}

/**
 * Expands the documented ports to the actual port count of a node. Ports
 * beyond the documented entries use the dynamic template when the block
 * declares one. Documentation only — it never changes handle ids, types,
 * order, or connection rules.
 */
function expandPortDocs(
  docs: BlockPortDoc[],
  count: number,
  dynamic?: BlockDynamicPorts,
): ResolvedPortDoc[] {
  const resolved: ResolvedPortDoc[] = [];
  for (let index = 0; index < count; index += 1) {
    const base =
      docs[index] ??
      (dynamic
        ? {
            index,
            labelEn: `${dynamic.labelEn} ${index + 1}`,
            labelTh: `${dynamic.labelTh} ${index + 1}`,
            dataType: dynamic.dataType,
            behaviorEn: dynamic.behaviorEn,
            behaviorTh: dynamic.behaviorTh,
            semanticsEn: dynamic.semanticsEn,
            semanticsTh: dynamic.semanticsTh,
          }
        : undefined);
    if (!base) continue;
    resolved.push({ ...base, index });
  }
  return resolved;
}

/**
 * Resolves the input and output port documentation for a node with the given
 * actual port counts. Dynamic-port blocks render documentation for every
 * currently configured port.
 */
export function blockPortDocs(type: string, inputCount = 0, outputCount = 0): ResolvedPortDocs {
  const ports = BLOCK_METADATA[type]?.ports ?? NO_PORTS;
  return {
    inputs: expandPortDocs(ports.inputs, Math.max(0, Math.trunc(inputCount)), ports.dynamicInputs),
    outputs: expandPortDocs(ports.outputs, Math.max(0, Math.trunc(outputCount)), ports.dynamicOutputs),
  };
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
