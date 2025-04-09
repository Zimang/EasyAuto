// test_log.js - 简单测试脚本
toast("脚本开始执行");
log("===TEST_LOG_START===");

// 模拟一次查图行为（不需要真的查图）
sleep(1000);  // 等待一下
log("查图逻辑执行完毕");

// 返回一个假结果
let found = true;
log("图片是否找到: " + found);

log("===TEST_LOG_END===");
