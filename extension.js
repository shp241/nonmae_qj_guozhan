import { lib, game, ui, get, ai, _status } from "../../noname.js";
import { content } from "./main/content.js";
import { precontent } from "./main/precontent.js";
import config from "./main/config.js";

const extensionInfo = await lib.init.promises.json(
	`${lib.assetURL}extension/乔剪国战/info.json`
);
let extensionPackage = {
	name: "乔剪国战",
	config,
	content,
	help: {},
	package: {},
	precontent,
	files: { character: [], card: [], skill: [], audio: [] },
};

Object.keys(extensionInfo)
	.filter((key) => key !== "name")
	.forEach((key) => {
		extensionPackage.package[key] = extensionInfo[key];
	});

export let type = "extension";
export default extensionPackage;
