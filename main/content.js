import { lib, game, ui, get, ai, _status } from "../../../noname.js";



// 在你的扩展content函数中
export async function content(extension, pack, config) {
  lib.translate.qj_biao = "标准包";
  lib.translate.qj_yicong = "翼从";
  lib.characterSort['mode_extension_乔剪国战']={
    'qj_biao':["qj_caocao", "qj_simayi", "qj_xiahoudun", "qj_zhangliao", "qj_xuzhu", "qj_guojia", "qj_zhenji", "qj_xiahouyuan", "qj_zhanghe", "qj_xuhuang", "qj_caoren", "qj_dianwei", "qj_xunyu", "qj_caopi", "qj_yuejin", "qj_liubei", "qj_guanyu", "qj_zhangfei", "qj_zhugeliang", "qj_zhaoyun", "qj_machao", "qj_huangyueying", "qj_huangzhong", "qj_weiyan", "qj_pangtong", "qj_wolong", "qj_liushan", "qj_menghuo", "qj_zhurongfuren", "qj_ganfuren", "qj_sunquan", "qj_ganning", "qj_lvmeng", "qj_huanggai", "qj_zhouyu", "qj_daqiao", "qj_luxun", "qj_sunshangxiang", "qj_sunjian", "qj_xiaoqiao", "qj_taishici", "qj_zhoutai", "qj_lusu", "qj_zhangzhao", "qj_dingfeng", "qj_huatuo", "qj_lvbu", "qj_diaochan", "qj_yuanshao", "qj_yanliangwenchou", "qj_jiaxu", "qj_pangde", "qj_zhangjiao", "qj_caiwenji", "qj_mateng", "qj_jiling", "qj_tianfeng", "qj_panfeng", "qj_zoushi", "qj_hansui", "qj_simayan", "qj_simashi", "qj_simazhao", "qj_jiachong", "qj_yanghu", "qj_wangyuanji", "qj_xiahouhui", "qj_jinsimayi", "qj_zhangchunhua", "qj_zhanghuyuechen", "qj_yanghuiyu", "qj_wangjun", "qj_wenyang", "qj_shibao", "qj_zhanghua", "qj_liuxie", "qj_liubian", "qj_zhangrang", "qj_hejin", "qj_wangyun", "qj_wangrong", "qj_fuhuanghou", "qj_fuwan", "qj_dongcheng", "qj_tangji", "qj_caiyong", "qj_huangfusong", "qj_liuchongluojun", "qj_kannan", "qj_jianshuo", ],
    'qj_yicong':["yc_niujin", "qj_zhoucang", "yc_quexiaojiang", "yc_wenhu", "yc_mushun", "yc_huweijun", "yc_baimayicong", "yc_xiangbing", "yc_jinfanjun", "yc_bingzhoulangqi", "yc_huangjinleishi", "yc_fuxinsishi", "yc_xiyuanjun"],
  };
  lib.perfectPair=[];
  lib.perfectPair.caocao=["dianwei","xuchu"];
  lib.perfectPair.xiahoudun=["xiahouyuan"];
  
    
}
