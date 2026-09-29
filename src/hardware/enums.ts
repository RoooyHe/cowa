import type { EnumTable } from "./contract";

// 枚举翻译（issue #4 / issue #1「说话方式」）：把 WMI 的数值枚举翻成人话。
// 这是**查表**，不是推测。查不到的 code 写 `未知`——绝不把裸数值放上屏。
// 翻译只为了好看的那些（厂商代码 `CMN` → `奇美`）不在这里，也不做。

// Win32_PhysicalMemory.SMBIOSMemoryType（与 SMBIOS 的内存类型表一致）。
const MEMORY_TYPES: Readonly<Record<number, string>> = {
  2: "DRAM",
  17: "SDRAM",
  20: "DDR",
  21: "DDR2",
  24: "DDR3",
  26: "DDR4",
  27: "LPDDR",
  28: "LPDDR2",
  29: "LPDDR3",
  30: "LPDDR4",
  32: "HBM",
  33: "HBM2",
  34: "DDR5",
  35: "LPDDR5",
};

// Win32_ComputerSystem.PCSystemType。
const SYSTEM_TYPES: Readonly<Record<number, string>> = {
  1: "台式机",
  2: "笔记本",
  3: "工作站",
  4: "企业服务器",
  5: "小型办公服务器",
  6: "家电电脑",
  7: "高性能服务器",
  8: "最大性能",
};

const TABLES: Readonly<Record<EnumTable, Readonly<Record<number, string>>>> = {
  memoryType: MEMORY_TYPES,
  systemType: SYSTEM_TYPES,
};

export function translateEnum(table: EnumTable, code: number): string {
  return TABLES[table][code] ?? "未知";
}
