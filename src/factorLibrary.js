// 内置碳因子参考库。
// 建材因子为 GB/T 51366-2019 附录D 表D.0.1 全表导入（与标准完全同口径，逐条对照原文核实）；
// 运输因子为附录E 表E.0.1 全表；能源因子来自生态环境部、国家统计局 2025年第47号公告
// 与附录A 表A.0.1（天然气按常用低位热值折算）。
// 注意：不同数据库（如 CPCD）边界口径不同，不要与库内因子混用于同一次比较。
// 库中条目仍不能代替产品 EPD 或按项目实际核定的因子（标准 6.2.4：有第三方审核数据时优先）。
export const FACTOR_LIBRARY = [
  // ===== A1–A3 建材生产（GB/T 51366-2019 附录D 表D.0.1 全表） =====
  // — 混凝土 —
  { id: "mat-c30", category: "material", group: "混凝土", name: "C30 混凝土", unit: "m³", factor: 295, source: "GB/T 51366-2019 附录D 表D.0.1", note: "295 kgCO₂e/m³；标准仅列出 C30 与 C50 两档。" },
  { id: "mat-c50", category: "material", group: "混凝土", name: "C50 混凝土", unit: "m³", factor: 385, source: "GB/T 51366-2019 附录D 表D.0.1", note: "385 kgCO₂e/m³；其他强度等级（如 C40）标准未列出，需另行选用可靠来源。" },
  // — 砌体与水泥 —
  { id: "mat-cement", category: "material", group: "砌体与水泥", name: "普通硅酸盐水泥（市场平均）", unit: "t", factor: 735, source: "GB/T 51366-2019 附录D 表D.0.1", note: "735 kgCO₂e/t。" },
  { id: "mat-lime", category: "material", group: "砌体与水泥", name: "石灰（市场平均）", unit: "t", factor: 1190, source: "GB/T 51366-2019 附录D 表D.0.1", note: "1190 kgCO₂e/t。" },
  { id: "mat-slaked-lime", category: "material", group: "砌体与水泥", name: "消石灰（熟石灰、氢氧化钙）", unit: "t", factor: 747, source: "GB/T 51366-2019 附录D 表D.0.1", note: "747 kgCO₂e/t。" },
  { id: "mat-gypsum", category: "material", group: "砌体与水泥", name: "天然石膏", unit: "t", factor: 32.8, source: "GB/T 51366-2019 附录D 表D.0.1", note: "32.8 kgCO₂e/t。" },
  { id: "mat-sand", category: "material", group: "砌体与水泥", name: "砂（细度模数 1.6~3.0）", unit: "t", factor: 2.51, source: "GB/T 51366-2019 附录D 表D.0.1", note: "2.51 kgCO₂e/t。" },
  { id: "mat-gravel", category: "material", group: "砌体与水泥", name: "碎石（10~30mm）", unit: "t", factor: 2.18, source: "GB/T 51366-2019 附录D 表D.0.1", note: "2.18 kgCO₂e/t。" },
  { id: "mat-shale-rock", category: "material", group: "砌体与水泥", name: "页岩石", unit: "t", factor: 5.08, source: "GB/T 51366-2019 附录D 表D.0.1", note: "5.08 kgCO₂e/t。" },
  { id: "mat-clay", category: "material", group: "砌体与水泥", name: "黏土", unit: "t", factor: 2.69, source: "GB/T 51366-2019 附录D 表D.0.1", note: "2.69 kgCO₂e/t。" },
  { id: "mat-concrete-brick", category: "material", group: "砌体与水泥", name: "混凝土砖（240×115×90）", unit: "m³", factor: 336, source: "GB/T 51366-2019 附录D 表D.0.1", note: "336 kgCO₂e/m³，按砖块体积计。" },
  { id: "mat-fly-ash-brick", category: "material", group: "砌体与水泥", name: "蒸压粉煤灰砖（240×115×53）", unit: "m³", factor: 341, source: "GB/T 51366-2019 附录D 表D.0.1", note: "341 kgCO₂e/m³。" },
  { id: "mat-sintered-fly-ash-brick", category: "material", group: "砌体与水泥", name: "烧结粉煤灰实心砖（240×115×53，掺入量 50%）", unit: "m³", factor: 134, source: "GB/T 51366-2019 附录D 表D.0.1", note: "134 kgCO₂e/m³。" },
  { id: "mat-shale-solid-brick", category: "material", group: "砌体与水泥", name: "页岩实心砖（240×115×53）", unit: "m³", factor: 292, source: "GB/T 51366-2019 附录D 表D.0.1", note: "292 kgCO₂e/m³。" },
  { id: "mat-shale-brick", category: "material", group: "砌体与水泥", name: "页岩空心砖（240×115×53）", unit: "m³", factor: 204, source: "GB/T 51366-2019 附录D 表D.0.1", note: "204 kgCO₂e/m³，与项目演示清单一致。" },
  { id: "mat-clay-hollow-brick", category: "material", group: "砌体与水泥", name: "黏土空心砖（240×115×53）", unit: "m³", factor: 250, source: "GB/T 51366-2019 附录D 表D.0.1", note: "250 kgCO₂e/m³。" },
  { id: "mat-gangue-solid-brick", category: "material", group: "砌体与水泥", name: "煤矸石实心砖（240×115×53，90% 掺量）", unit: "m³", factor: 22.8, source: "GB/T 51366-2019 附录D 表D.0.1", note: "22.8 kgCO₂e/m³。" },
  { id: "mat-gangue-hollow-brick", category: "material", group: "砌体与水泥", name: "煤矸石空心砖（240×115×53，90% 掺量）", unit: "m³", factor: 16, source: "GB/T 51366-2019 附录D 表D.0.1", note: "16.0 kgCO₂e/m³。" },
  // — 钢材与生铁 —
  { id: "mat-pig-iron", category: "material", group: "钢材与生铁", name: "炼钢生铁", unit: "t", factor: 1700, source: "GB/T 51366-2019 附录D 表D.0.1", note: "1700 kgCO₂e/t。" },
  { id: "mat-cast-iron", category: "material", group: "钢材与生铁", name: "铸造生铁", unit: "t", factor: 2280, source: "GB/T 51366-2019 附录D 表D.0.1", note: "2280 kgCO₂e/t。" },
  { id: "mat-ferroalloy", category: "material", group: "钢材与生铁", name: "炼钢用铁合金（市场平均）", unit: "t", factor: 9530, source: "GB/T 51366-2019 附录D 表D.0.1", note: "9530 kgCO₂e/t。" },
  { id: "mat-bof-steel", category: "material", group: "钢材与生铁", name: "转炉碳钢", unit: "t", factor: 1990, source: "GB/T 51366-2019 附录D 表D.0.1", note: "1990 kgCO₂e/t。" },
  { id: "mat-eaf-steel", category: "material", group: "钢材与生铁", name: "电炉碳钢", unit: "t", factor: 3030, source: "GB/T 51366-2019 附录D 表D.0.1", note: "3030 kgCO₂e/t；电炉工艺依赖废钢与电力结构。" },
  { id: "mat-steel", category: "material", group: "钢材与生铁", name: "普通碳钢（市场平均）", unit: "t", factor: 2050, source: "GB/T 51366-2019 附录D 表D.0.1", note: "2050 kgCO₂e/t；无法区分工艺时可用。" },
  { id: "mat-steel-small-section", category: "material", group: "钢材与生铁", name: "热轧碳钢小型型钢", unit: "t", factor: 2310, source: "GB/T 51366-2019 附录D 表D.0.1", note: "2310 kgCO₂e/t。" },
  { id: "mat-steel-medium-section", category: "material", group: "钢材与生铁", name: "热轧碳钢中小型钢", unit: "t", factor: 2365, source: "GB/T 51366-2019 附录D 表D.0.1", note: "2365 kgCO₂e/t。" },
  { id: "mat-steel-large-rail-billet", category: "material", group: "钢材与生铁", name: "热轧碳钢大型轨梁（方圆坯、管坯）", unit: "t", factor: 2340, source: "GB/T 51366-2019 附录D 表D.0.1", note: "2340 kgCO₂e/t。" },
  { id: "mat-steel-large-rail-heavy", category: "material", group: "钢材与生铁", name: "热轧碳钢大型轨梁（重轨、普通型钢）", unit: "t", factor: 2380, source: "GB/T 51366-2019 附录D 表D.0.1", note: "2380 kgCO₂e/t。" },
  { id: "mat-steel-plate", category: "material", group: "钢材与生铁", name: "热轧碳钢中厚板", unit: "t", factor: 2400, source: "GB/T 51366-2019 附录D 表D.0.1", note: "2400 kgCO₂e/t。" },
  { id: "mat-steel-h", category: "material", group: "钢材与生铁", name: "热轧碳钢 H 钢", unit: "t", factor: 2350, source: "GB/T 51366-2019 附录D 表D.0.1", note: "2350 kgCO₂e/t。" },
  { id: "mat-steel-wide-strip", category: "material", group: "钢材与生铁", name: "热轧碳钢宽带钢", unit: "t", factor: 2310, source: "GB/T 51366-2019 附录D 表D.0.1", note: "2310 kgCO₂e/t。" },
  { id: "mat-rebar", category: "material", group: "钢材与生铁", name: "热轧碳钢钢筋", unit: "t", factor: 2340, source: "GB/T 51366-2019 附录D 表D.0.1", note: "2340 kgCO₂e/t。" },
  { id: "mat-steel-wire-rod", category: "material", group: "钢材与生铁", name: "热轧碳钢高线材", unit: "t", factor: 2375, source: "GB/T 51366-2019 附录D 表D.0.1", note: "2375 kgCO₂e/t。" },
  { id: "mat-steel-bar", category: "material", group: "钢材与生铁", name: "热轧碳钢棒材", unit: "t", factor: 2340, source: "GB/T 51366-2019 附录D 表D.0.1", note: "2340 kgCO₂e/t。" },
  { id: "mat-steel-pipe-spiral", category: "material", group: "钢材与生铁", name: "螺旋埋弧焊管", unit: "t", factor: 2520, source: "GB/T 51366-2019 附录D 表D.0.1", note: "2520 kgCO₂e/t。" },
  { id: "mat-steel-pipe-lsaw-large", category: "material", group: "钢材与生铁", name: "大口径埋弧焊直缝钢管", unit: "t", factor: 2430, source: "GB/T 51366-2019 附录D 表D.0.1", note: "2430 kgCO₂e/t。" },
  { id: "mat-steel-pipe-lsaw", category: "material", group: "钢材与生铁", name: "焊接直缝钢管", unit: "t", factor: 2530, source: "GB/T 51366-2019 附录D 表D.0.1", note: "2530 kgCO₂e/t。" },
  { id: "mat-steel-pipe-seamless", category: "material", group: "钢材与生铁", name: "热轧碳钢无缝钢管", unit: "t", factor: 3150, source: "GB/T 51366-2019 附录D 表D.0.1", note: "3150 kgCO₂e/t。" },
  { id: "mat-steel-pipe-cold-drawn", category: "material", group: "钢材与生铁", name: "冷拔冷轧碳钢无缝钢管", unit: "t", factor: 3680, source: "GB/T 51366-2019 附录D 表D.0.1", note: "3680 kgCO₂e/t。" },
  { id: "mat-steel-galvanized", category: "material", group: "钢材与生铁", name: "碳钢热镀锌板卷", unit: "t", factor: 3110, source: "GB/T 51366-2019 附录D 表D.0.1", note: "3110 kgCO₂e/t。" },
  { id: "mat-steel-electro-galvanized", category: "material", group: "钢材与生铁", name: "碳钢电镀锌板卷", unit: "t", factor: 3020, source: "GB/T 51366-2019 附录D 表D.0.1", note: "3020 kgCO₂e/t。" },
  { id: "mat-steel-tinplate", category: "material", group: "钢材与生铁", name: "碳钢电镀锡板卷", unit: "t", factor: 2870, source: "GB/T 51366-2019 附录D 表D.0.1", note: "2870 kgCO₂e/t。" },
  { id: "mat-steel-pickled", category: "material", group: "钢材与生铁", name: "酸洗板卷", unit: "t", factor: 1730, source: "GB/T 51366-2019 附录D 表D.0.1", note: "1730 kgCO₂e/t。" },
  { id: "mat-steel-cold-rolled", category: "material", group: "钢材与生铁", name: "冷轧碳钢板卷", unit: "t", factor: 2530, source: "GB/T 51366-2019 附录D 表D.0.1", note: "2530 kgCO₂e/t。" },
  { id: "mat-steel-cold-hardened", category: "material", group: "钢材与生铁", name: "冷硬碳钢板卷", unit: "t", factor: 2410, source: "GB/T 51366-2019 附录D 表D.0.1", note: "2410 kgCO₂e/t。" },
  // — 金属与玻璃 —
  { id: "mat-glass", category: "material", group: "金属与玻璃", name: "平板玻璃", unit: "t", factor: 1130, source: "GB/T 51366-2019 附录D 表D.0.1", note: "1130 kgCO₂e/t。" },
  { id: "mat-alu-ingot", category: "material", group: "金属与玻璃", name: "电解铝（全国平均电网电力）", unit: "t", factor: 20300, source: "GB/T 51366-2019 附录D 表D.0.1", note: "20300 kgCO₂e/t；再生比例越高取值越低。" },
  { id: "mat-alu-sheet", category: "material", group: "金属与玻璃", name: "铝板带", unit: "t", factor: 28500, source: "GB/T 51366-2019 附录D 表D.0.1", note: "28500 kgCO₂e/t。" },
  { id: "mat-alu-window", category: "material", group: "金属与玻璃", name: "断桥铝合金窗（100% 原生铝型材）", unit: "m²", factor: 254, source: "GB/T 51366-2019 附录D 表D.0.1", note: "254 kgCO₂e/m²。" },
  { id: "mat-alu-window-recycled", category: "material", group: "金属与玻璃", name: "断桥铝合金窗（原生铝:再生铝=7:3）", unit: "m²", factor: 194, source: "GB/T 51366-2019 附录D 表D.0.1", note: "194 kgCO₂e/m²。" },
  { id: "mat-alu-wood-window", category: "material", group: "金属与玻璃", name: "铝木复合窗（100% 原生铝型材）", unit: "m²", factor: 147, source: "GB/T 51366-2019 附录D 表D.0.1", note: "147 kgCO₂e/m²。" },
  { id: "mat-alu-wood-window-recycled", category: "material", group: "金属与玻璃", name: "铝木复合窗（原生铝:再生铝=7:3）", unit: "m²", factor: 122.5, source: "GB/T 51366-2019 附录D 表D.0.1", note: "122.5 kgCO₂e/m²。" },
  { id: "mat-alu-plastic-window", category: "material", group: "金属与玻璃", name: "铝塑共挤窗", unit: "m²", factor: 129.5, source: "GB/T 51366-2019 附录D 表D.0.1", note: "129.5 kgCO₂e/m²。" },
  { id: "mat-pvc-window", category: "material", group: "金属与玻璃", name: "塑钢窗", unit: "m²", factor: 121, source: "GB/T 51366-2019 附录D 表D.0.1", note: "121 kgCO₂e/m²。" },
  { id: "mat-copper-plate", category: "material", group: "金属与玻璃", name: "铜板", unit: "m²", factor: 218, source: "GB/T 51366-2019 附录D 表D.0.1", note: "218 kgCO₂e/m²。" },
  // — 保温与防水 —
  { id: "mat-eps", category: "material", group: "保温与防水", name: "聚苯乙烯泡沫板", unit: "t", factor: 5020, source: "GB/T 51366-2019 附录D 表D.0.1", note: "5020 kgCO₂e/t；标准未单列 XPS，按同一因子对待并核对产品 EPD。" },
  { id: "mat-rockwool", category: "material", group: "保温与防水", name: "岩棉板", unit: "t", factor: 1980, source: "GB/T 51366-2019 附录D 表D.0.1", note: "1980 kgCO₂e/t。" },
  { id: "mat-pu", category: "material", group: "保温与防水", name: "硬泡聚氨酯板", unit: "t", factor: 5220, source: "GB/T 51366-2019 附录D 表D.0.1", note: "5220 kgCO₂e/t。" },
  { id: "mat-alu-plastic-panel", category: "material", group: "保温与防水", name: "铝塑复合板", unit: "m²", factor: 8.06, source: "GB/T 51366-2019 附录D 表D.0.1", note: "8.06 kgCO₂e/m²。" },
  { id: "mat-cu-plastic-panel", category: "material", group: "保温与防水", name: "铜塑复合板", unit: "m²", factor: 37.1, source: "GB/T 51366-2019 附录D 表D.0.1", note: "37.1 kgCO₂e/m²。" },
  // — 管材与塑料原料 —
  { id: "mat-ppr", category: "material", group: "管材与塑料", name: "无规共聚聚丙烯管（PPR）", unit: "kg", factor: 3.72, source: "GB/T 51366-2019 附录D 表D.0.1", note: "3.72 kgCO₂e/kg。" },
  { id: "mat-pe-pipe", category: "material", group: "管材与塑料", name: "聚乙烯管", unit: "kg", factor: 3.6, source: "GB/T 51366-2019 附录D 表D.0.1", note: "3.60 kgCO₂e/kg。" },
  { id: "mat-pvc-pipe", category: "material", group: "管材与塑料", name: "硬聚氯乙烯管", unit: "kg", factor: 7.93, source: "GB/T 51366-2019 附录D 表D.0.1", note: "7.93 kgCO₂e/kg。" },
  { id: "mat-ps", category: "material", group: "管材与塑料", name: "普通聚苯乙烯", unit: "t", factor: 4620, source: "GB/T 51366-2019 附录D 表D.0.1", note: "4620 kgCO₂e/t。" },
  { id: "mat-lldpe", category: "material", group: "管材与塑料", name: "线性低密度聚乙烯", unit: "t", factor: 1990, source: "GB/T 51366-2019 附录D 表D.0.1", note: "1990 kgCO₂e/t。" },
  { id: "mat-hdpe", category: "material", group: "管材与塑料", name: "高密度聚乙烯（HDPE）", unit: "t", factor: 2620, source: "GB/T 51366-2019 附录D 表D.0.1", note: "2620 kgCO₂e/t。" },
  { id: "mat-ldpe", category: "material", group: "管材与塑料", name: "低密度聚乙烯（LDPE）", unit: "t", factor: 2810, source: "GB/T 51366-2019 附录D 表D.0.1", note: "2810 kgCO₂e/t。" },
  { id: "mat-pvc", category: "material", group: "管材与塑料", name: "聚氯乙烯（市场平均）", unit: "t", factor: 7300, source: "GB/T 51366-2019 附录D 表D.0.1", note: "7300 kgCO₂e/t。" },
  // — 其他 —
  { id: "mat-water", category: "material", group: "其他", name: "自来水", unit: "t", factor: 0.168, source: "GB/T 51366-2019 附录D 表D.0.1", note: "0.168 kgCO₂e/t；可用于施工或运营用水量的粗估。" },
  // ===== A4 运输（GB/T 51366-2019 附录E 表E.0.1 全表） =====
  { id: "trn-light-gasoline", category: "transport", group: "公路·汽油", name: "轻型汽油货车（载重 2t）", unit: "t·km", factor: 0.334, source: "GB/T 51366-2019 附录E 表E.0.1", note: "0.334 kgCO₂e/(t·km)。" },
  { id: "trn-medium-gasoline", category: "transport", group: "公路·汽油", name: "中型汽油货车（载重 8t）", unit: "t·km", factor: 0.115, source: "GB/T 51366-2019 附录E 表E.0.1", note: "0.115 kgCO₂e/(t·km)。" },
  { id: "trn-heavy-gasoline", category: "transport", group: "公路·汽油", name: "重型汽油货车（载重 10t/18t）", unit: "t·km", factor: 0.104, source: "GB/T 51366-2019 附录E 表E.0.1", note: "0.104 kgCO₂e/(t·km)，10t 与 18t 同值。" },
  { id: "trn-ldv-2t", category: "transport", group: "公路·柴油", name: "轻型柴油货车（载重 2t）", unit: "t·km", factor: 0.286, source: "GB/T 51366-2019 附录E 表E.0.1", note: "0.286 kgCO₂e/(t·km)。" },
  { id: "trn-mdv-8t", category: "transport", group: "公路·柴油", name: "中型柴油货车（载重 8t）", unit: "t·km", factor: 0.179, source: "GB/T 51366-2019 附录E 表E.0.1", note: "0.179 kgCO₂e/(t·km)。" },
  { id: "trn-hdv-10t", category: "transport", group: "公路·柴油", name: "重型柴油货车（载重 10t）", unit: "t·km", factor: 0.162, source: "GB/T 51366-2019 附录E 表E.0.1", note: "0.162 kgCO₂e/(t·km)。" },
  { id: "trn-hdv-18t", category: "transport", group: "公路·柴油", name: "重型柴油货车（载重 18t）", unit: "t·km", factor: 0.129, source: "GB/T 51366-2019 附录E 表E.0.1", note: "0.129 kgCO₂e/(t·km)。" },
  { id: "trn-hdv-30t", category: "transport", group: "公路·柴油", name: "重型柴油货车（载重 30t）", unit: "t·km", factor: 0.078, source: "GB/T 51366-2019 附录E 表E.0.1", note: "0.078 kgCO₂e/(t·km)。" },
  { id: "trn-hdv-46t", category: "transport", group: "公路·柴油", name: "重型柴油货车（载重 46t）", unit: "t·km", factor: 0.057, source: "GB/T 51366-2019 附录E 表E.0.1", note: "0.057 kgCO₂e/(t·km)。" },
  { id: "trn-rail", category: "transport", group: "铁路", name: "铁路运输（中国市场平均）", unit: "t·km", factor: 0.01, source: "GB/T 51366-2019 附录E 表E.0.1", note: "0.010 kgCO₂e/(t·km)；电力机车 0.010、内燃机车 0.011。" },
  { id: "trn-water-liquid", category: "transport", group: "水路", name: "液货船运（载重 2000t）", unit: "t·km", factor: 0.019, source: "GB/T 51366-2019 附录E 表E.0.1", note: "0.019 kgCO₂e/(t·km)。" },
  { id: "trn-water-dry", category: "transport", group: "水路", name: "干散货船运（载重 2500t）", unit: "t·km", factor: 0.015, source: "GB/T 51366-2019 附录E 表E.0.1", note: "0.015 kgCO₂e/(t·km)。" },
  { id: "trn-container", category: "transport", group: "水路", name: "集装箱船运（200TEU）", unit: "t·km", factor: 0.012, source: "GB/T 51366-2019 附录E 表E.0.1", note: "0.012 kgCO₂e/(t·km)。" },
  // ===== B6 能源（生态环境部、国家统计局公告 2025年第47号；GB/T 51366-2019 附录A） =====
  { id: "eng-grid-2023", category: "energy", group: "电力·全国", name: "电力（2023 年全国平均）", unit: "kWh", factor: 0.5306, target: "electricity", source: "生态环境部、国家统计局公告 2025年第47号 表1", note: "0.5306 kgCO₂/kWh；已与公告附件核对。" },
  { id: "eng-grid-north", category: "energy", group: "电力·区域", name: "电力（2023 年华北区域）", unit: "kWh", factor: 0.6361, target: "electricity", source: "生态环境部、国家统计局公告 2025年第47号 表2", note: "0.6361 kgCO₂/kWh。" },
  { id: "eng-grid-northeast", category: "energy", group: "电力·区域", name: "电力（2023 年东北区域）", unit: "kWh", factor: 0.5122, target: "electricity", source: "生态环境部、国家统计局公告 2025年第47号 表2", note: "0.5122 kgCO₂/kWh。" },
  { id: "eng-grid-east", category: "energy", group: "电力·区域", name: "电力（2023 年华东区域）", unit: "kWh", factor: 0.55, target: "electricity", source: "生态环境部、国家统计局公告 2025年第47号 表2", note: "0.5500 kgCO₂/kWh。" },
  { id: "eng-grid-central", category: "energy", group: "电力·区域", name: "电力（2023 年华中区域）", unit: "kWh", factor: 0.5271, target: "electricity", source: "生态环境部、国家统计局公告 2025年第47号 表2", note: "0.5271 kgCO₂/kWh。" },
  { id: "eng-grid-northwest", category: "energy", group: "电力·区域", name: "电力（2023 年西北区域）", unit: "kWh", factor: 0.5543, target: "electricity", source: "生态环境部、国家统计局公告 2025年第47号 表2", note: "0.5543 kgCO₂/kWh。" },
  { id: "eng-grid-south", category: "energy", group: "电力·区域", name: "电力（2023 年南方区域）", unit: "kWh", factor: 0.4042, target: "electricity", source: "生态环境部、国家统计局公告 2025年第47号 表2", note: "0.4042 kgCO₂/kWh。" },
  { id: "eng-grid-southwest", category: "energy", group: "电力·区域", name: "电力（2023 年西南区域）", unit: "kWh", factor: 0.2472, target: "electricity", source: "生态环境部、国家统计局公告 2025年第47号 表2", note: "0.2472 kgCO₂/kWh；公告表3 另列各省级因子。" },
  { id: "eng-gas", category: "energy", group: "燃气", name: "管道天然气", unit: "m³", factor: 2.16, target: "gas", source: "GB/T 51366-2019 附录A 表A.0.1（55.54 tCO₂/TJ）折算", note: "55.54 tCO₂/TJ × 常用低位热值 38.93 MJ/m³ ≈ 2.16 kgCO₂/m³；实际热值不同时请按附录A 因子重新折算。" },
  { id: "eng-lpg-gas", category: "energy", group: "燃气", name: "液化石油气（LPG，按质量）", unit: "kg", factor: 3.1, target: "gas", source: "GB/T 51366-2019 附录A 表A.0.1（61.81 tCO₂/TJ）× 低位热值 50.24 MJ/kg 折算；省级清单指南口径为 3.101", note: "≈3.10 kgCO₂e/kg（仅 CO₂），与《省级温室气体清单指南》3.101 kgCO₂/kg 互相印证；注意与 m³ 口径的管道天然气不可混用。" },
  { id: "eng-heat-gj", category: "energy", group: "市政热力", name: "市政热力（外购热量）", unit: "GJ", factor: 110, target: "heat", source: "发改办气候〔2011〕1041号体系的行业核算指南推荐缺省值 0.11 tCO₂/GJ", note: "110 kgCO₂e/GJ ≈ 0.0396 kgCO₂e/kWh 热量。优先采用当地生态环境部门发布的官方热力因子（如上海 2022 年为 0.06 tCO₂/GJ）。" },
  { id: "eng-heat-kwh", category: "energy", group: "市政热力", name: "市政热力（按 kWh 热量）", unit: "kWh", factor: 0.0396, target: "heat", source: "发改办气候〔2011〕1041号体系 0.11 tCO₂/GJ 折算（1 kWh = 3.6 MJ）", note: "≈0.0396 kgCO₂e/kWh 热量；与电力量纲相同但含义不同，填写时区分用电量与购热量。" },
  // ===== A5 施工燃料（GB/T 51366-2019 附录A 表A.0.1 单位热值因子 × GB/T 2589-2020 折标准煤系数推热值，同口径折算到每千克） =====
  { id: "eng-diesel-kg", category: "energy", group: "燃料", name: "柴油", unit: "kg", factor: 3.1, source: "GB/T 51366-2019 附录A 表A.0.1（72.59 tCO₂/TJ）× GB/T 2589 热值 42.70 MJ/kg 折算", note: "≈3.10 kgCO₂e/kg；按密度 0.84 kg/L 折算约 2.60 kgCO₂e/L。挖掘机、卡车等施工机械最常用。" },
  { id: "eng-gasoline-kg", category: "energy", group: "燃料", name: "汽油", unit: "kg", factor: 2.93, source: "GB/T 51366-2019 附录A 表A.0.1（67.91 tCO₂/TJ）× GB/T 2589 热值 43.12 MJ/kg 折算", note: "≈2.93 kgCO₂e/kg；按密度 0.73 kg/L 折算约 2.14 kgCO₂e/L。" },
  { id: "eng-lpg-kg", category: "energy", group: "燃料", name: "液化石油气（LPG）", unit: "kg", factor: 3.11, source: "GB/T 51366-2019 附录A 表A.0.1（61.81 tCO₂/TJ）× GB/T 2589 热值 50.24 MJ/kg 折算", note: "≈3.11 kgCO₂e/kg。" },
  { id: "eng-fuel-oil-kg", category: "energy", group: "燃料", name: "燃料油", unit: "kg", factor: 3.18, source: "GB/T 51366-2019 附录A 表A.0.1（75.82 tCO₂/TJ）× GB/T 2589 热值 41.87 MJ/kg 折算", note: "≈3.18 kgCO₂e/kg。" },
  { id: "eng-coal-raw", category: "energy", group: "燃料", name: "原煤（烟煤口径）", unit: "kg", factor: 1.86, source: "GB/T 51366-2019 附录A 表A.0.1（烟煤 89.00 tCO₂/TJ）× GB/T 2589 热值 20.91 MJ/kg 折算", note: "≈1.86 kgCO₂e/kg；无烟煤口径约 1.98，按实际煤种核对。" },
  // ===== B6 省级电力（生态环境部、国家统计局公告 2025年第47号 表3，2023 年省级电力平均因子；公告未列西藏） =====
  { id: "eng-pv-beijing", category: "energy", group: "电力·省级", name: "电力（2023 年·北京）", unit: "kWh", factor: 0.5554, target: "electricity", source: "生态环境部、国家统计局公告 2025年第47号 表3" },
  { id: "eng-pv-tianjin", category: "energy", group: "电力·省级", name: "电力（2023 年·天津）", unit: "kWh", factor: 0.6796, target: "electricity", source: "生态环境部、国家统计局公告 2025年第47号 表3" },
  { id: "eng-pv-hebei", category: "energy", group: "电力·省级", name: "电力（2023 年·河北）", unit: "kWh", factor: 0.6516, target: "electricity", source: "生态环境部、国家统计局公告 2025年第47号 表3" },
  { id: "eng-pv-shanxi", category: "energy", group: "电力·省级", name: "电力（2023 年·山西）", unit: "kWh", factor: 0.6634, target: "electricity", source: "生态环境部、国家统计局公告 2025年第47号 表3" },
  { id: "eng-pv-neimenggu", category: "energy", group: "电力·省级", name: "电力（2023 年·内蒙古）", unit: "kWh", factor: 0.6479, target: "electricity", source: "生态环境部、国家统计局公告 2025年第47号 表3" },
  { id: "eng-pv-liaoning", category: "energy", group: "电力·省级", name: "电力（2023 年·辽宁）", unit: "kWh", factor: 0.4878, target: "electricity", source: "生态环境部、国家统计局公告 2025年第47号 表3" },
  { id: "eng-pv-jilin", category: "energy", group: "电力·省级", name: "电力（2023 年·吉林）", unit: "kWh", factor: 0.4671, target: "electricity", source: "生态环境部、国家统计局公告 2025年第47号 表3" },
  { id: "eng-pv-heilongjiang", category: "energy", group: "电力·省级", name: "电力（2023 年·黑龙江）", unit: "kWh", factor: 0.5229, target: "electricity", source: "生态环境部、国家统计局公告 2025年第47号 表3" },
  { id: "eng-pv-shanghai", category: "energy", group: "电力·省级", name: "电力（2023 年·上海）", unit: "kWh", factor: 0.5737, target: "electricity", source: "生态环境部、国家统计局公告 2025年第47号 表3" },
  { id: "eng-pv-jiangsu", category: "energy", group: "电力·省级", name: "电力（2023 年·江苏）", unit: "kWh", factor: 0.5827, target: "electricity", source: "生态环境部、国家统计局公告 2025年第47号 表3" },
  { id: "eng-pv-zhejiang", category: "energy", group: "电力·省级", name: "电力（2023 年·浙江）", unit: "kWh", factor: 0.4974, target: "electricity", source: "生态环境部、国家统计局公告 2025年第47号 表3" },
  { id: "eng-pv-anhui", category: "energy", group: "电力·省级", name: "电力（2023 年·安徽）", unit: "kWh", factor: 0.6553, target: "electricity", source: "生态环境部、国家统计局公告 2025年第47号 表3" },
  { id: "eng-pv-fujian", category: "energy", group: "电力·省级", name: "电力（2023 年·福建）", unit: "kWh", factor: 0.4211, target: "electricity", source: "生态环境部、国家统计局公告 2025年第47号 表3" },
  { id: "eng-pv-jiangxi", category: "energy", group: "电力·省级", name: "电力（2023 年·江西）", unit: "kWh", factor: 0.5836, target: "electricity", source: "生态环境部、国家统计局公告 2025年第47号 表3" },
  { id: "eng-pv-shandong", category: "energy", group: "电力·省级", name: "电力（2023 年·山东）", unit: "kWh", factor: 0.6191, target: "electricity", source: "生态环境部、国家统计局公告 2025年第47号 表3" },
  { id: "eng-pv-henan", category: "energy", group: "电力·省级", name: "电力（2023 年·河南）", unit: "kWh", factor: 0.5897, target: "electricity", source: "生态环境部、国家统计局公告 2025年第47号 表3" },
  { id: "eng-pv-hubei", category: "energy", group: "电力·省级", name: "电力（2023 年·湖北）", unit: "kWh", factor: 0.4044, target: "electricity", source: "生态环境部、国家统计局公告 2025年第47号 表3" },
  { id: "eng-pv-hunan", category: "energy", group: "电力·省级", name: "电力（2023 年·湖南）", unit: "kWh", factor: 0.4976, target: "electricity", source: "生态环境部、国家统计局公告 2025年第47号 表3" },
  { id: "eng-pv-guangdong", category: "energy", group: "电力·省级", name: "电力（2023 年·广东）", unit: "kWh", factor: 0.4419, target: "electricity", source: "生态环境部、国家统计局公告 2025年第47号 表3" },
  { id: "eng-pv-guangxi", category: "energy", group: "电力·省级", name: "电力（2023 年·广西）", unit: "kWh", factor: 0.4476, target: "electricity", source: "生态环境部、国家统计局公告 2025年第47号 表3" },
  { id: "eng-pv-hainan", category: "energy", group: "电力·省级", name: "电力（2023 年·海南）", unit: "kWh", factor: 0.3648, target: "electricity", source: "生态环境部、国家统计局公告 2025年第47号 表3" },
  { id: "eng-pv-chongqing", category: "energy", group: "电力·省级", name: "电力（2023 年·重庆）", unit: "kWh", factor: 0.5581, target: "electricity", source: "生态环境部、国家统计局公告 2025年第47号 表3" },
  { id: "eng-pv-sichuan", category: "energy", group: "电力·省级", name: "电力（2023 年·四川）", unit: "kWh", factor: 0.1564, target: "electricity", source: "生态环境部、国家统计局公告 2025年第47号 表3" },
  { id: "eng-pv-guizhou", category: "energy", group: "电力·省级", name: "电力（2023 年·贵州）", unit: "kWh", factor: 0.5683, target: "electricity", source: "生态环境部、国家统计局公告 2025年第47号 表3" },
  { id: "eng-pv-yunnan", category: "energy", group: "电力·省级", name: "电力（2023 年·云南）", unit: "kWh", factor: 0.1333, target: "electricity", source: "生态环境部、国家统计局公告 2025年第47号 表3" },
  { id: "eng-pv-shaanxi", category: "energy", group: "电力·省级", name: "电力（2023 年·陕西）", unit: "kWh", factor: 0.6335, target: "electricity", source: "生态环境部、国家统计局公告 2025年第47号 表3" },
  { id: "eng-pv-gansu", category: "energy", group: "电力·省级", name: "电力（2023 年·甘肃）", unit: "kWh", factor: 0.4471, target: "electricity", source: "生态环境部、国家统计局公告 2025年第47号 表3" },
  { id: "eng-pv-qinghai", category: "energy", group: "电力·省级", name: "电力（2023 年·青海）", unit: "kWh", factor: 0.1796, target: "electricity", source: "生态环境部、国家统计局公告 2025年第47号 表3" },
  { id: "eng-pv-ningxia", category: "energy", group: "电力·省级", name: "电力（2023 年·宁夏）", unit: "kWh", factor: 0.6187, target: "electricity", source: "生态环境部、国家统计局公告 2025年第47号 表3" },
  { id: "eng-pv-xinjiang", category: "energy", group: "电力·省级", name: "电力（2023 年·新疆）", unit: "kWh", factor: 0.6021, target: "electricity", source: "生态环境部、国家统计局公告 2025年第47号 表3", note: "公告表3 共 30 个省级因子，未含西藏。" },
];

export const FACTOR_CATEGORIES = [
  { id: "material", label: "建材 A1–A3" },
  { id: "transport", label: "运输 A4" },
  { id: "energy", label: "能源 B6" },
];

const normalize = (value) => String(value ?? "").toLowerCase().replace(/\s/g, "");

export function searchFactors(category, query) {
  const keyword = normalize(query);
  return FACTOR_LIBRARY.filter((entry) => entry.category === category)
    .filter((entry) => !keyword || [entry.name, entry.unit, entry.source, entry.group, entry.note].some((field) => normalize(field).includes(keyword)));
}

export function findFactor(id) {
  return FACTOR_LIBRARY.find((entry) => entry.id === id) || null;
}
