import test from "node:test";
import assert from "node:assert/strict";
import { classifyBuildingType, deriveBuildingGeometry } from "../src/geometry.js";
import { parseProjectWorkbook } from "../src/projectImport.js";

test("project name selects education facade when an explicit type is absent", () => {
  const project = { name: "演示教学楼", area: 3600, floors: 6, geometry: { length: 30, width: 20, floorHeight: 3.2, layout: "linear" } };
  const geometry = deriveBuildingGeometry(project);
  assert.equal(geometry.type.id, "education");
  assert.equal(geometry.length, 30);
  assert.equal(geometry.width, 20);
  assert.equal(geometry.source, "uploaded");
});

test("explicit building use overrides name and changes inferred proportions", () => {
  const project = { name: "项目 A", buildingType: "工业厂房", area: 2800, floors: 1 };
  const geometry = deriveBuildingGeometry(project);
  assert.equal(geometry.type.id, "industrial");
  assert.equal(geometry.floorHeight, 5);
  assert.equal(Number((geometry.length / geometry.width).toFixed(1)), 2.8);
  assert.equal(geometry.source, "assumed");
});

test("unknown use remains generic instead of being called a dormitory", () => {
  assert.equal(classifyBuildingType({ name: "项目 A" }).id, "generic");
  assert.equal(classifyBuildingType({ name: "教学楼", buildingType: "generic" }).id, "generic");
});

test("workbook building type controls the generated schematic", () => {
  const workbook = [
    { sheet: "材料清单", data: [["材料名称", "单位", "工程量", "碳因子", "因子来源"], ["钢筋", "t", 2, 1000, "演示"]] },
    { sheet: "项目参数", data: [["项目名称", "建筑类型", "建筑面积m2", "楼层数", "楼长m", "楼宽m", "层高m", "楼型"], ["项目 A", "医疗建筑", 1800, 3, 30, 20, 3.6, "双翼"]] },
  ];
  const project = parseProjectWorkbook(workbook).project;
  const geometry = deriveBuildingGeometry(project);
  assert.equal(geometry.type.id, "healthcare");
  assert.equal(geometry.layout, "double");
  assert.equal(geometry.floorHeight, 3.6);
});
