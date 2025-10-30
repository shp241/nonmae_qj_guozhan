import { lib, game, ui, get, ai, _status } from "../../../noname.js";
import { broadcastAll } from "../../../mode/guozhan/src/patch/game.js";

const qiaojian = [
  //黑桃普通
  ["spade", 1, "shandian"],
  ["spade", 1, "xietianzi"],
  ["spade", 1, "juedou"],
  ["spade", 2, "bagua"],
  ["spade", 2, "heiguangkai"],
  ["spade", 2, "cixiong"],
  ["spade", 2, "taigongyinfu"],
  ["spade", 3, "zhujinqiyuan", null, ["yingbian_zhuzhan", "yingbian_add"]],
  ["spade", 3, "huoshaolianying"],
  ["spade", 3, "shuiyanqijunx", null, ["yingbian_zhuzhan", "yingbian_add"]],
  ["spade", 4, "guohe"],
  ["spade", 4, "sha"],
  ["spade", 4, "shuiyanqijunx", null, ["yingbian_zhuzhan", "yingbian_add"]],
  ["spade", 5, "jueying"],
  ["spade", 5, "qinglong"],
  ["spade", 5, "sha"],
  ["spade", 6, "qinggang"],
  ["spade", 6, "jiu"],
  ["spade", 6, "sha", "ice"],
  ["spade", 7, "sha"],
  ["spade", 7, "sha"],
  ["spade", 7, "sha", "ice"],
  ["spade", 8, "sha", "ice"],
  ["spade", 8, "sha", "ice"],
  ["spade", 8, "sha"],
  ["spade", 9, "jiu"],
  ["spade", 9, "sha", "thunder"],
  ["spade", 9, "sha"],
  ["spade", 10, "bingliang"],
  ["spade", 10, "sha", "thunder"],
  ["spade", 10, "sha", null, ["yingbian_canqu", "yingbian_add"]],
  ["spade", 11, "wuxie", null, ["yingbian_kongchao", "yingbian_draw"]],
  ["spade", 11, "sha", null, ["yingbian_canqu", "yingbian_add"]],
  ["spade", 11, "sha", "thunder"],
  ["spade", 12, "zhangba"],
  ["spade", 12, "lulitongxin"],
  ["spade", 12, "tiesuo"],
  ["spade", 13, "wutiesuolian"],
  ["spade", 13, "wuxie"],
  ["spade", 13, "nanman", null, ["yingbian_fujia", "yingbian_remove"]],
  //草花普通
  ["club", 1, "juedou"],
  ["club", 1, "yuxi"],
  ["club", 1, "huxinjing"],
  ["club", 2, "sha"],
  ["club", 2, "tianjitu"],
  ["club", 2, "renwang"],
  ["club", 2, "tengjia"],
  ["club", 3, "sha"],
  ["club", 3, "chiling"],
  ["club", 3, "zhibi"],
  ["club", 4, "sha", null, ["yingbian_kongchao", "yingbian_add"]],
  ["club", 4, "sha", "thunder"],
  ["club", 4, "zhibi"],
  ["club", 5, "sha", null, ["yingbian_kongchao", "yingbian_add"]],
  ["club", 5, "sha", "thunder"],
  ["club", 5, "tongque"],
  ["club", 6, "sha", "thunder"],
  ["club", 6, "sha", null, ["yingbian_kongchao", "yingbian_add"]],
  ["club", 6, "lebu"],
  ["club", 7, "sha", "thunder"],
  ["club", 7, "sha"],
  ["club", 7, "nanman", null, ["yingbian_fujia", "yingbian_remove"]],
  ["club", 8, "sha", "thunder"],
  ["club", 8, "sha", null, ["yingbian_canqu", "yingbian_add"]],
  ["club", 8, "sha"],
  ["club", 9, "sha"],
  ["club", 9, "jiu"],
  ["club", 9, "jiu"],
  ["club", 10, "bingliang"],
  ["club", 10, "lulitongxin"],
  ["club", 10, "sha"],
  ["club", 11, "sha"],
  ["club", 11, "huoshaolianying"],
  ["club", 11, "sha"],
  ["club", 12, "zhujinqiyuan", null, ["yingbian_zhuzhan", "yingbian_add"]],
  ["club", 12, "jiedao", null, ["yingbian_fujia", "yingbian_hit"]],
  ["club", 12, "tiesuo"],
  ["club", 13, "tiesuo"],
  ["club", 13, "wuxie", null, ["guo"]],
  ["club", 13, "wuxie", null, ["guo"]],
  //红桃普通
  // ["heart", 1, "wanjian"],
  // ["heart", 1, "taoyuan"],
  // ["heart", 1, "lianjunshengyan"],
  // ["heart", 2, "shan"],
  // ["heart", 2, "chuqibuyi", null, ["yingbian_zhuzhan", "yingbian_add"]],
  // ["heart", 2, "diaohulishan"],
  // ["heart", 3, "chuqibuyi", null, ["yingbian_zhuzhan", "yingbian_add"]],
  // ["heart", 3, "wugu"],
  // ["heart", 3, "jingfanma"],
  // ["heart", 4, "tao"],
  // ["heart", 4, "sha", "fire", ["yingbian_canqu", "yingbian_damage"]],
  // ["heart", 4, "shan"],
  // ["heart", 5, "qilin"],
  // ["heart", 5, "chitu"],
  // ["heart", 5, "shan", null, ["yingbian_kongchao", "yingbian_draw"]],
  // ["heart", 6, "lebu"],
  // ["heart", 6, "tao"],
  // ["heart", 6, "shan", null, ["yingbian_kongchao", "yingbian_draw"]],
  // ["heart", 7, "tao"],
  // ["heart", 7, "dongzhuxianji"],
  // ["heart", 7, "shan"],
  // ["heart", 8, "tao"],
  // ["heart", 8, "dongzhuxianji"],
  // ["heart", 8, "tao"],
  // ["heart", 9, "tao"],
  // ["heart", 9, "yuanjiao"],
  // ["heart", 9, "tao"],
  // ["heart", 10, "sha"],
  // ["heart", 10, "shan"],
  // ["heart", 10, "sha"],
  // ["heart", 11, "yiyi"],
  // ["heart", 11, "tao"],
  // ["heart", 11, "sha", null, ["yingbian_zhuzhan", "yingbian_add"]],
  // ["heart", 12, "tao"],
  // ["heart", 12, "sha"],
  // ["heart", 12, "huoshaolianying"],
  // ["heart", 13, "zhuahuang"],
  // ["heart", 13, "shan"],
  // ["heart", 13, "huogong", null, ["yingbian_zhuzhan", "yingbian_add"]],
  // //方片普通
  // ["diamond", 1, "wuxinghelingshan"],
  // ["diamond", 1, "zhuge"],
  // ["diamond", 1, "xietianzi"],
  // ["diamond", 2, "shan"],
  // ["diamond", 2, "tao"],
  // ["diamond", 2, "tao"],
  // ["diamond", 3, "shunshou"],
  // ["diamond", 3, "shan"],
  // ["diamond", 3, "tao"],
  // ["diamond", 4, "yiyi"],
  // ["diamond", 4, "sha", "fire", ["yingbian_canqu", "yingbian_damage"]],
  // ["diamond", 4, "sha", "fire", ["yingbian_zhuzhan", "yingbian_add"]],
  // ["diamond", 5, "guanshi"],
  // ["diamond", 5, "sha", "fire"],
  // ["diamond", 5, "muniu"],
  // ["diamond", 6, "wuliu"],
  // ["diamond", 6, "shan"],
  // ["diamond", 6, "shan"],
  // ["diamond", 7, "shan", null, ["yingbian_kongchao", "yingbian_draw"]],
  // ["diamond", 7, "shan", null, ["yingbian_kongchao", "yingbian_draw"]],
  // ["diamond", 7, "shan"],
  // ["diamond", 8, "shan", null, ["yingbian_kongchao", "yingbian_draw"]],
  // ["diamond", 8, "shan", null, ["yingbian_kongchao", "yingbian_draw"]],
  // ["diamond", 8, "sha", "fire"],
  // ["diamond", 9, "jiu"],
  // ["diamond", 9, "shan"],
  // ["diamond", 9, "sha", "fire"],
  // ["diamond", 10, "shan"],
  // ["diamond", 10, "sha"],
  // ["diamond", 10, "diaohulishan"],
  // ["diamond", 11, "sha"],
  // ["diamond", 11, "shan"],
  // ["diamond", 11, "wuxie", null, ["guo"]],
  // ["diamond", 12, "sha"],
  // ["diamond", 12, "sanjian"],
  // ["diamond", 12, "wuxie", null, ["guo"]],
  // ["diamond", 12, "fangtian"],
  // ["diamond", 13, "zixin"],
  // ["diamond", 13, "shan"],
  // ["diamond", 13, "shan"],
];

function getRandomGroups(groups, banNumber) {
  // 复制数组避免修改原数组
  const shuffled = [...groups];

  // Fisher-Yates 洗牌算法
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // 返回前 banNumber 个元素
  return shuffled.slice(0, banNumber);
}

// 在你的扩展content函数中
export async function arenaReady(extension, pack, config) {
  lib.translate.qj_biao = "标准包";
  lib.translate.qj_yicong = "翼从";
  lib.characterSort['mode_extension_乔剪国战']={
    'qj_biao':["qj_caocao", "qj_simayi", "qj_xiahoudun", "qj_zhangliao", "qj_xuzhu", "qj_guojia", "qj_zhenji", "qj_xiahouyuan", "qj_zhanghe", "qj_xuhuang", "qj_caoren", "qj_dianwei", "qj_xunyu", "qj_caopi", "qj_yuejin", "qj_liubei", "qj_guanyu", "qj_zhangfei", "qj_zhugeliang", "qj_zhaoyun", "qj_machao", "qj_huangyueying", "qj_huangzhong", "qj_weiyan", "qj_pangtong", "qj_wolong", "qj_liushan", "qj_menghuo", "qj_zhurongfuren", "qj_ganfuren", "qj_sunquan", "qj_ganning", "qj_lvmeng", "qj_huanggai", "qj_zhouyu", "qj_daqiao", "qj_luxun", "qj_sunshangxiang", "qj_sunjian", "qj_xiaoqiao", "qj_taishici", "qj_zhoutai", "qj_lusu", "qj_zhangzhao", "qj_dingfeng", "qj_huatuo", "qj_lvbu", "qj_diaochan", "qj_yuanshao", "qj_yanliangwenchou", "qj_jiaxu", "qj_pangde", "qj_zhangjiao", "qj_caiwenji", "qj_mateng", "qj_jiling", "qj_tianfeng", "qj_panfeng", "qj_zoushi", "qj_hansui", "qj_simayan", "qj_simashi", "qj_simazhao", "qj_jiachong", "qj_yanghu", "qj_wangyuanji", "qj_xiahouhui", "qj_jinsimayi", "qj_zhangchunhua", "qj_zhanghuyuechen", "qj_yanghuiyu", "qj_wangjun", "qj_wenyang", "qj_shibao", "qj_zhanghua", "qj_liuxie", "qj_liubian", "qj_zhangrang", "qj_hejin", "qj_wangyun", "qj_wangrong", "qj_fuhuanghou", "qj_fuwan", "qj_dongcheng", "qj_tangji", "qj_caiyong", "qj_huangfusong", "qj_liuchongluojun", "qj_kannan", "qj_jianshuo", ],
    'qj_yicong':["yc_niujin", "qj_zhoucang", "yc_quexiaojiang", "yc_wenhu", "yc_mushun", "yc_huweijun", "yc_baimayicong", "yc_xiangbing", "yc_jinfanjun", "yc_bingzhoulangqi", "yc_huangjinleishi", "yc_fuxinsishi", "yc_xiyuanjun"],
  };
  lib.perfectPair=[];
  lib.perfectPair.caocao=["dianwei","xuchu"];
  lib.perfectPair.xiahoudun=["xiahouyuan"];
  const groups = ["wei", "shu", "wu", "qun", "jin","han"];
        let banNumber = 2;
        if (!get.config("banGroup") && banNumber>0) {
          const banGroups = getRandomGroups(groups, banNumber);
          let videoId = lib.status.videoId++;
          let createDialog = function (group, id) {
            // _status.bannedGroup = group;
            // 将禁用势力数组转换为翻译后的字符串
            const bannedGroupsText = banGroups.map(group => get.translation(group)).join('、');
            var dialog = ui.create.dialog(
                `本局禁用势力：${bannedGroupsText}`,
                [
                    [banGroups.map(group => ["", "", group]), "vcard"],
                    "forcebutton"
                ],
                "forcebutton"
            );
            dialog.videoId = id;
          };
          // 一次性记录所有禁用势力的日志
          const bannedGroupsText = banGroups.map(group =>
              `<span data-nature="${get.groupnature(group, "raw")}">${get.translation(group)}势力</span>`
          ).join('、');
  
          game.log("本局", bannedGroupsText, "遭到了禁用");
  
          // 循环广播每个势力的对话框
          banGroups.forEach(group => {
              game.broadcastAll(createDialog, `group_${group}`, event.videoId);
          });
          // 第一步：处理双势力角色
          for (const character in lib.character) {
              const info = get.character(character);
  
              if (info?.doubleGroup?.length) {
                  // 检查每个被禁用的势力是否在双势力中
                  for (const bannedGroup of banGroups) {
                      if (info.doubleGroup.includes(bannedGroup)) {
                          info.doubleGroup.remove(bannedGroup);
  
                          // 如果当前势力被禁用，切换到其他势力
                          if (info.group == bannedGroup && info.doubleGroup.length > 0) {
                              info.group = info.doubleGroup[0];
                          }
  
                          // 如果双势力只剩一个，清除双势力标记
                          if (info.doubleGroup.length === 1) {
                              info.doubleGroup = [];
                          }
                      }
                  }
              }
          }
          // 第二步：处理单势力角色
          for (const character in lib.character) {
              const info = get.character(character);
  
              // 检查角色势力是否在被禁用列表中
              if (banGroups.includes(info.group)) {
                  info.isUnseen = true;
              }
  
              // 广播更新
              game.broadcast((name, characterInfo) => {
                  get.character(name) = characterInfo;
              }, character, info);
          }
          await game.delay(5);
          game.broadcastAll("closeDialog", videoId);
        }
    
}
