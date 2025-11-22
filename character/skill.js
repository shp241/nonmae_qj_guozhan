import { lib, game, ui, get, ai, _status } from "../../../noname.js";
import { cast } from "../../../../noname/util/index.js";

/**
 * 创建统令类型技能模板
 * @param {string} skillName - 技能名称（如 "tl_xuchu"）
 * @param {string} ycName - 武将名（如 "yc_huweijun"）
 * @param {string} cardName - 卡牌名（如 "juedou"）
 * @param {string} cardTranslation - 卡牌翻译（如 "【决斗】"）
 * @param {boolean} [limitOne=false] - 是否限一（默认 false）
 * @returns {object} 支持链式调用的技能对象构建器
 */
function createTonglingSkill(skillName, ycName, cardName, cardTranslation, limitOne = false) {
	const globalSkillName = skillName + "_use";

	// 用于存储 viewAs 和 mod 的额外内容
	const viewAsExtras = {};
	const modExtras = {};

	// 创建技能对象
	const skillObj = {
		global: globalSkillName,
		trigger: {
			player: ["showCharacterAfter", "removeCharacterAfter", "die"],
		},
		forced: true,
		silent: true,
		charlotte: true,
		filter(event, player) {
			if (event.name == "showCharacter") {
				return event.toShow.some(name => get.character(name, 3).includes(skillName));
			} else if (event.name == "removeCharacter") {
				return get.character(event.toRemove, 3).includes(skillName);
			}
			return true;
		},
		async content(event, trigger, player) {
			let yc = ycName;
			if (trigger.name == "showCharacter") {
				if (limitOne) {
					let bool = await game.addTongling(player.identity, yc, 1);
					if (!bool) {
						return;
					}
				} else {
					await game.addTongling(player.identity, yc);
				}
				let players = game.players.sortBySeat();
				for (let p in players) {
					if (players[p].isFriendOf(player)) {
						if (players[p].name1.startsWith("gz_shibing")) {
							var name = players[p].name1;
							game.log(players[p], "士兵变为了" + get.translation(yc));
							players[p].reinit(name, yc, false);
							players[p].showCharacter(0, false);
							// @ts-expect-error 类型就是这么写的
							_status.characterlist.add(name);
							if (!game.useTongling(player.identity, yc)) {
								break;
							}
						}
						if (players[p].name2.startsWith("gz_shibing")) {
							var name = players[p].name2;
							game.log(players[p], "士兵变为了" + get.translation(yc));
							players[p].reinit(name, yc, false);
							players[p].showCharacter(1, false);
							// @ts-expect-error 类型就是这么写的
							_status.characterlist.add(name);
							if (!game.useTongling(player.identity, yc)) {
								break;
							}
						}
					}
				}
			} else {
				await game.removeTongling(player.identity, yc);
			}
		},
		subSkill: {
			use: {
				enable: "chooseToUse",
				sourceSkill: skillName,
				hiddenCard(player, name) {
					if (name != cardName) {
						return false;
					}
					return viewAsFilter(player);
				},
				get viewAs() {
					return {
						name: cardName,
						isCard: true,
						...viewAsExtras,
					};
				},
				get mod() {
					return {
						...modExtras,
					};
				},
				viewAsFilter(player) {
					// 限一检查：检查全局所有玩家是否使用过该技能
					if (limitOne) {
						for (let p of game.players) {
							if (p.getAllHistory("useSkill", evt => evt.skill == globalSkillName || evt.sourceSkill == globalSkillName).length > 0) {
								return false;
							}
						}
					}
					var sources = game.filterPlayer(function (current) {
						return current.hasSkill(skillName);
					});
					let isFriend = false;
					for (let s in sources) {
						if (player.isFriendOf(sources[s])) {
							isFriend = true;
						}
					}
					return isFriend && !player.hasShibing();
				},
				filterCard: () => false,
				prompt: "视为使用" + cardTranslation,
				selectCard: [0, 1],
				check: () => 1,
				log: false,
				async precontent(event, trigger, player) {
					game.log(player, "使用了" + get.translation(skillName) + "，移除了一个武将。");
					let tl = skillName;
					if (lib.character[player.name1].skills.includes(tl)) {
						await player.removeCharacter(1);
					} else if (lib.character[player.name2].skills.includes(tl)) {
						await player.removeCharacter(0);
					} else {
						let result = await player
							.chooseControl(player.name1, player.name2)
							.set("dialog", ["请移除一个武将", [[player.name1, player.name2], "character"]])
							.set("ai", () => {
								let rank = get.guozhanRank(player.name1, player) - get.guozhanRank(player.name2, player);
								if (rank == 0) {
									rank = Math.random() > 0.5 ? 1 : -1;
								}
								return rank > 0 ? player.name2 : player.name1;
							})
							.forResult();
						if (result.control) {
							if (player.name1 == result.control) {
								await player.removeCharacter(0);
							} else if (player.name2 == result.control) {
								await player.removeCharacter(1);
							}
						}
					}
				},
				ai: {
					order(skill, player) {
						if (!player) {
							player = get.player();
						}
						let ycs = game.getTongling(player.identity);
						let max = 0;
						for (let yc of ycs) {
							if (get.guozhanRank(yc, player) > max) {
								max = get.guozhanRank(yc, player);
							}
						}
						let char1 = get.guozhanRank(player.name1, player);
						let char2 = get.guozhanRank(player.name2, player);
						for (let skill of player.awakenedSkills) {
							if (lib.character[player.name1][3].includes(skill)) {
								char1 -= 3;
							}
							if (lib.character[player.name2][3].includes(skill)) {
								char2 -= 3;
							}
						}
						return max - Math.min(char1, char2) + 3 * Math.random();
					},
					result: {
						player(player) {
							return player.getUseValue({ name: cardName });
						},
					},
				},
			},
		},
	};

	// 返回支持链式调用的构建器，同时支持展开运算符
	const proxy = new Proxy(skillObj, {
		get(target, prop, receiver) {
			if (prop === "set") {
				return (key, value) => {
					if (key === "viewAs") {
						Object.assign(viewAsExtras, value);
					} else if (key === "mod") {
						Object.assign(modExtras, value);
					}
					return receiver;
				};
			}
			return Reflect.get(target, prop, receiver);
		},
		ownKeys(target) {
			return Reflect.ownKeys(target);
		},
		getOwnPropertyDescriptor(target, prop) {
			return Reflect.getOwnPropertyDescriptor(target, prop);
		},
	});
	return proxy;
}

/** @type { importCharacterConfig['skill'] } */
const skill = {
	qj_jianxiong: {
		audio: "jianxiong",
		trigger: {
			player: "damageEnd",
		},
		preHidden: true,
		async content(event, trigger, player) {
			await player.draw();
			const result = await player
				.chooseToDiscard("he")
				.set("check", function (card) {
					if (
						cards.reduce((sum, card) => {
							return sum + (card.name == "du" ? -1 : 1);
						}, 0) > 1 ||
						player.getUseValue(cards[0]) > 6
					) {
						return 1;
					}
					return 0;
				})
				.set("ai", function (card) {
					return 8 - get.value(card);
				})
				.set("prompt", "弃置一张牌以获得对你造成伤害的牌。")
				.forResult();
			if (result.bool) {
				await player.gain(trigger.cards.filterInD(), "gain2");
			}
		},
		ai: {
			maixie: true,
			maixie_hp: true,
			effect: {
				target(card, player, target) {
					if (player.hasSkillTag("jueqing", false, target)) {
						return [1, -1];
					}
					if (get.tag(card, "damage") && player != target) {
						return [1, 0.6];
					}
				},
			},
		},
	},
	qj_guicai: {
		audio: "guicai",
		trigger: { global: "judge" },
		preHidden: true,
		filter(event, player) {
			return player.countCards("hes") > 0;
		},
		async cost(event, trigger, player) {
			let prompt = get.translation(trigger.player) + "的" + (trigger.judgestr || "") + "判定为" + get.translation(trigger.player.judging[0]) + "，" + get.prompt("reguicai");
			const next = player.chooseCard(prompt, "hes", function (card) {
				var player = _status.event.player;
				var mod2 = game.checkMod(card, player, "unchanged", "cardEnabled2", player);
				if (mod2 != "unchanged") {
					return mod2;
				}
				var mod = game.checkMod(card, player, "unchanged", "cardRespondable", player);
				if (mod != "unchanged") {
					return mod;
				}
				return true;
			});
			next.set("ai", check);
			next.set("judging", trigger.player.judging[0]);
			event.result = await next.forResult();
			return;
			function check(card) {
				var trigger = _status.event.getTrigger();
				var player = _status.event.player;
				var judging = _status.event.judging;
				var result = trigger.judge(card) - trigger.judge(judging);
				var attitude = get.attitude(player, trigger.player);
				let val = get.value(card);
				if (get.subtype(card) == "equip2") {
					val /= 2;
				} else {
					val /= 4;
				}
				if (attitude == 0 || result == 0) {
					return 0;
				}
				if (attitude > 0) {
					return result - val;
				}
				return -result - val;
			}
		},
		async content(event, trigger, player) {
			await player.respond(event.cards, "qj_guicai", "highlight", "noOrdering");
			if (trigger.player.judging[0].clone) {
				trigger.player.judging[0].clone.classList.remove("thrownhighlight");
				game.broadcast(function (card) {
					if (card.clone) {
						card.clone.classList.remove("thrownhighlight");
					}
				}, trigger.player.judging[0]);
				game.addVideo("deletenode", player, get.cardsInfo([trigger.player.judging[0].clone]));
			}
			game.cardsDiscard(trigger.player.judging[0]);
			trigger.player.judging[0] = event.cards[0];
			trigger.orderingCards.addArray(event.cards);
			game.log(trigger.player, "的判定牌改为", event.cards[0]);
			game.delay(2);
		},
		ai: {
			rejudge: true,
			tag: {
				rejudge: 1,
			},
		},
	},
	qj_fankui: {
		audio: "fankui",
		trigger: { player: "damageEnd" },
		logTarget: "source",
		preHidden: true,
		filter(event, player) {
			return event.source && event.source.countGainableCards(player, event.source != player ? "he" : "e") > 0 && event.num > 0;
		},
		async content(event, trigger, player) {
			player.gainPlayerCard(true, trigger.source, trigger.source != player ? "he" : "e");
		},
		ai: {
			maixie_defend: true,
			effect: {
				target(card, player, target) {
					if (player.countCards("he") > 1 && get.tag(card, "damage")) {
						if (player.hasSkillTag("jueqing", false, target)) {
							return [1, -1.5];
						}
						if (get.attitude(target, player) < 0) {
							return [1, 1];
						}
					}
				},
			},
		},
	},
	qj_ganglie: {
		audio: "ganglie",
		trigger: {
			player: "damageEnd",
		},
		/**
		 * @param {GameEvent} event
		 * @param {PlayerGuozhan} _player
		 * @returns {boolean}
		 */
		filter(event, _player) {
			return event.source != undefined && event.num > 0;
		},
		/**
		 * @param {GameEvent} event
		 * @param {PlayerGuozhan} player
		 * @returns {boolean}
		 */
		check(event, player) {
			return get.attitude(player, event.source) <= 0;
		},
		logTarget: "source",
		preHidden: true,
		/**
		 * @param {GameEvent} event
		 * @param {GameEvent} trigger
		 * @param {PlayerGuozhan} player
		 */
		async content(event, trigger, player) {
			const result = await player.judge(card => (get.color(card) == "red" ? 1 : 0)).forResult();

			switch (result.color) {
				case "black":
					if (trigger.source.countCards("he")) {
						player.discardPlayerCard(trigger.source, "he", true);
					}
					break;

				case "red":
					if (trigger.source.isIn()) {
						trigger.source.damage();
					}
					break;
				default:
					break;
			}
		},
		ai: {
			maixie_defend: true,
			expose: 0.4,
		},
	},
	qj_chizhong: {
		audio: "qingjian",
		trigger: {
			player: "gainAfter",
			global: "loseAsyncAfter",
		},
		preHidden: true,
		filter(event, player) {
			if (player.hasSkill("qj_chizhong_used")) {
				return false;
			}
			var evt = event.getParent("phaseDraw");
			if (evt.player == player) {
				return false;
			}
			return player.countCards("h") > player.hp;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCardTarget({
					position: "h",
					filterCard: true,
					selectCard: [1, player.countCards("h") - player.hp],
					filterTarget: lib.filter.notMe,
					ai1(card) {
						const player = get.player();
						if (card.name != "du" && get.attitude(player, _status.currentPhase) < 0 && _status.currentPhase?.needsToDiscard()) {
							return -1;
						}
						for (var i = 0; i < ui.selected.cards.length; i++) {
							if (get.type(ui.selected.cards[i]) == get.type(card) || (ui.selected.cards[i].name == "du" && card.name != "du")) {
								return -1;
							}
						}
						if (card.name == "du") {
							return 20;
						}
						return player.countCards("h") - player.hp;
					},
					ai2(target) {
						const player = get.player();
						if (get.attitude(player, _status.currentPhase) < 0) {
							return -1;
						}
						const att = get.attitude(player, target);
						if (ui.selected.cards.length && ui.selected.cards[0].name == "du") {
							if (target.hasSkillTag("nodu")) {
								return 0;
							}
							return 1 - att;
						}
						if (target.countCards("h") > player.countCards("h")) {
							return 0;
						}
						return att - 4;
					},
					prompt: get.prompt2("请选择交给其他角色的牌"),
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
				cards,
			} = event;
			await player.give(cards, target);
			player.addTempSkill("qj_chizhong_used", "phaseJieshuAfter");
		},
		ai: {
			expose: 0.3,
		},
		subSkill: {
			used: {
				charlotte: true,
			},
		},
	},
	qj_tuxi: {
		audio: "tuxi",
		audioname2: { gz_jun_caocao: "jianan_tuxi" },
		trigger: {
			player: "phaseDrawBegin2",
		},
		preHidden: true,
		filter(event, player) {
			return (
				event.num > 0 &&
				!event.numFixed &&
				game.hasPlayer(function (target) {
					return target.countCards("h") > 0 && player != target;
				})
			);
		},
		async cost(event, trigger, player) {
			var num = get.copy(trigger.num);
			const next = player.chooseTarget(get.prompt("new_retuxi"), "获得至多" + get.translation(num) + "名角色的各一张手牌，然后少摸等量的牌", [1, num], (card, player, target) => target.countCards("h") > 0 && player != target);
			next.setHiddenSkill("qj_tuxi");
			next.set("ai", check);
			event.result = await next.forResult();
			return;
			function check(target) {
				var att = get.attitude(_status.event.player, target);
				if (target.hasSkill("tuntian")) {
					return att / 10;
				}
				return 1 - att;
			}
		},
		async content(event, trigger, player) {
			event.targets.sortBySeat();
			player.logSkill("new_retuxi", event.targets);
			await player.gainMultiple(event.targets);
			trigger.num -= event.targets.length;
			if (trigger.num <= 0) {
				game.delay();
			}
		},
		ai: {
			threaten: 1.6,
			expose: 0.2,
		},
	},
	qj_luoyi: {
		audio: "luoyi",
		trigger: {
			player: "phaseDrawEnd",
		},
		preHidden: true,
		/**
		 * @param {GameEvent} _event
		 * @param {PlayerGuozhan} player
		 * @returns {boolean}
		 */
		filter(_event, player) {
			return player.countCards("he") > 0;
		},
		/**
		 * @param {GameEvent} event
		 * @param {GameEvent} _trigger
		 * @param {PlayerGuozhan} player
		 */
		async cost(event, _trigger, player) {
			const next = player.chooseToDiscard("he", get.prompt2("gz_luoyi"));

			next.setHiddenSkill("gz_luoyi");
			next.set("ai", check);

			event.result = await next.forResult();

			return;

			/**
			 * @param {Card} card
			 * @returns {number}
			 */
			function check(card) {
				const player = get.player();

				if (player.hasCard(cardx => cardx != card && (cardx.name == "sha" || cardx.name == "juedou") && player.hasValueTarget(cardx, undefined, true), "hs")) {
					return 5 - get.value(card);
				}

				return -get.value(card);
			}
		},
		/**
		 * @param {GameEvent} _event
		 * @param {GameEvent} _trigger
		 * @param {PlayerGuozhan} player
		 */
		async content(_event, _trigger, player) {
			player.addTempSkill("qj_luoyi_buff");
		},
		subSkill: {
			buff: {
				audio: "luoyi",
				charlotte: true,
				forced: true,
				trigger: {
					source: "damageBegin1",
				},
				/**
				 * @param {GameEvent} event
				 * @param {PlayerGuozhan} _player
				 * @returns {boolean}
				 */
				filter(event, _player) {
					const parent = event.getParent();
					if (parent == null || !("type" in parent)) {
						return false;
					}
					return event.card && (event.card.name == "sha" || event.card.name == "juedou") && parent.type == "card";
				},
				/**
				 * @param {GameEvent} _event
				 * @param {GameEvent} trigger
				 * @param {PlayerGuozhan} _player
				 */
				async content(_event, trigger, _player) {
					trigger.num++;
				},
			},
		},
	},
	qj_qingzi: {
		audio: "qingzi",
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return game.hasPlayer(current => {
				if (current == player || !current.isFriendOf(player)) {
					return false;
				}
				return current.hasCard(card => {
					return lib.filter.canBeDiscarded(card, player, current);
				}, "e");
			});
		},
		derivation: "qj_shensu",
		preHidden: true,
		async cost(event, trigger, player) {
			player
				.chooseTarget(get.prompt("jsrgqingzi"), "你可以弃置一名与你势力相同的其他角色装备区里的一张牌，然后令这些角色获得“神速”直到其回合结束", (card, player, target) => {
					return (
						target != player &&
						target.hasCard(card => {
							return lib.filter.canBeDiscarded(card, player, target);
						}, "e") &&
						target.isFriendOf(player)
					);
				})
				.set("ai", target => {
					var player = _status.event.player;
					return target.hasCard(card => {
						return (lib.filter.canBeDiscarded(card, player, target) && get.value(card, target) > 3) || (target.hp == 1 && get.value(card, target) > 0);
					});
				});
		},
		async content(event, trigger, player) {
			var target = event.target;
			player.discardPlayerCard(target, "e", true);
			const skill = event.name + "_effect";
			target.addAdditionalSkills(skill, "qj_shensu");
			target.addTempSkill(skill, { player: "phaseAfter" });
		},
	},
	qj_yiji: {
		audio: "yiji",
		trigger: { player: "damageEnd" },
		frequent: true,
		preHidden: true,
		filter(event) {
			return event.num > 0;
		},
		async content(event, trigger, player) {
			const { cards } = await game.cardsGotoOrdering(get.cards(2));
			if (_status.connectMode) {
				game.broadcastAll(function () {
					_status.noclearcountdown = true;
				});
			}
			event.given_map = {};
			if (!cards.length) {
				return;
			}
			do {
				const {
					result: { bool, links },
				} =
					cards.length == 1
						? { result: { links: cards.slice(0), bool: true } }
						: await player.chooseCardButton("遗计：请选择要分配的牌", true, cards, [1, cards.length]).set("ai", () => {
								if (ui.selected.buttons.length == 0) {
									return 1;
								}
								return 0;
						  });
				if (!bool) {
					return;
				}
				cards.removeArray(links);
				event.togive = links.slice(0);
				const {
					result: { targets },
				} = await player
					.chooseTarget("选择一名角色获得" + get.translation(links), true)
					.set("ai", target => {
						const att = get.attitude(_status.event.player, target);
						if (_status.event.enemy) {
							return -att;
						} else if (att > 0) {
							return att / (1 + target.countCards("h"));
						} else {
							return att / 100;
						}
					})
					.set("enemy", get.value(event.togive[0], player, "raw") < 0);
				if (targets.length) {
					const id = targets[0].playerid,
						map = event.given_map;
					if (!map[id]) {
						map[id] = [];
					}
					map[id].addArray(event.togive);
				}
			} while (cards.length > 0);
			if (_status.connectMode) {
				game.broadcastAll(function () {
					delete _status.noclearcountdown;
					game.stopCountChoose();
				});
			}
			const list = [];
			for (const i in event.given_map) {
				const source = (_status.connectMode ? lib.playerOL : game.playerMap)[i];
				player.line(source, "green");
				if (player !== source && (get.mode() !== "identity" || player.identity !== "nei")) {
					player.addExpose(0.2);
				}
				list.push([source, event.given_map[i]]);
			}
			game.loseAsync({
				gain_list: list,
				giver: player,
				animate: "draw",
			}).setContent("gaincardMultiple");
		},
		ai: {
			maixie: true,
			maixie_hp: true,
			effect: {
				target(card, player, target) {
					if (get.tag(card, "damage")) {
						if (player.hasSkillTag("jueqing", false, target)) {
							return [1, -2];
						}
						if (!target.hasFriend()) {
							return;
						}
						let num = 1;
						if (get.attitude(player, target) > 0) {
							if (player.needsToDiscard()) {
								num = 0.7;
							} else {
								num = 0.5;
							}
						}
						if (target.hp >= 4) {
							return [1, num * 2];
						}
						if (target.hp == 3) {
							return [1, num * 1.5];
						}
						if (target.hp == 2) {
							return [1, num * 0.5];
						}
					}
				},
			},
		},
	},
	qj_luoshen: {
		audio: "luoshen",
		trigger: { player: "phaseZhunbeiBegin" },
		frequent: true,
		preHidden: true,
		async content(event, trigger, player) {
			event.cards ??= [];
			while (true) {
				const judgeEvent = player.judge(card => {
					if (get.color(card) == "black") {
						return 1.5;
					}
					return -1.5;
				});
				judgeEvent.judge2 = result => result.bool;
				judgeEvent.set("callback", async event => {
					if (event.judgeResult.color == "black") {
						event.getParent().orderingCards.remove(event.card);
					}
				});
				let result;
				result = await judgeEvent.forResult();
				if (result?.bool && result?.card) {
					event.cards.push(result.card);
					result = await player.chooseBool("是否再次发动【洛神】？").set("frequentSkill", "luoshen").forResult();
					if (!result?.bool) {
						break;
					}
				} else {
					break;
				}
			}
			if (event.cards.someInD()) {
				await player.gain(event.cards.filterInD(), "gain2");
			}
		},
	},
	qj_qingguo: {
		mod: {
			aiValue(player, card, num) {
				if (get.name(card) != "shan" && get.color(card) != "black") {
					return;
				}
				const cards = player.getCards("hs", card => get.name(card) == "shan" || get.color(card) == "black");
				cards.sort((a, b) => {
					return (get.name(b) == "shan" ? 1 : 2) - (get.name(a) == "shan" ? 1 : 2);
				});
				const geti = () => {
					if (cards.includes(card)) {
						cards.indexOf(card);
					}
					return cards.length;
				};
				if (get.name(card) == "shan") {
					return Math.min(num, [6, 4, 3][Math.min(geti(), 2)]) * 0.6;
				}
				return Math.max(num, [6.5, 4, 3][Math.min(geti(), 2)]);
			},
			aiUseful() {
				return lib.skill.qingguo.mod.aiValue.apply(this, arguments);
			},
		},
		locked: false,
		preHidden: true,
		audio: "qingguo",
		enable: ["chooseToRespond", "chooseToUse"],
		filterCard(card) {
			return get.color(card) == "black";
		},
		viewAs: { name: "shan" },
		viewAsFilter(player) {
			if (!player.countCards("hs", { color: "black" })) {
				return false;
			}
		},
		position: "hs",
		prompt: "将一张黑色手牌当闪使用或打出",
		check() {
			return 1;
		},
		ai: {
			order: 3,
			respondShan: true,
			skillTagFilter(player) {
				if (!player.countCards("hs", { color: "black" })) {
					return false;
				}
			},
			effect: {
				target(card, player, target, current) {
					if (get.tag(card, "respondShan") && current < 0) {
						return 0.6;
					}
				},
			},
		},
	},
	qj_shensu: {
		audio: "shensu1",
		group: ["qj_shensu_1", "qj_shensu_2", "qj_shensu_3"],
		preHidden: ["qj_hensu_1", "qj_shensu_2", "qj_shensu_3"],
		subSkill: {
			1: {
				audio: "shensu1",
				trigger: { player: "phaseJudgeBefore" },
				sourceSkill: "qj_shensu",
				async cost(event, trigger, player) {
					event.result = await player
						.chooseTarget(get.prompt("qj_shensu"), "跳过判定阶段和摸牌阶段，视为对一名其他角色使用一张【杀】", function (card, player, target) {
							if (player == target) {
								return false;
							}
							return player.canUse({ name: "sha" }, target, false);
						})
						.set("check", player.countCards("h") > 2)
						.set("ai", function (target) {
							if (!_status.event.check) {
								return 0;
							}
							return get.effect(target, { name: "sha" }, _status.event.player);
						})
						.setHiddenSkill(event.skill)
						.forResult();
				},
				async content(event, trigger, player) {
					trigger.cancel();
					player.skip("phaseDraw");
					await player.useCard({ name: "sha", isCard: true }, event.targets[0], false);
				},
			},
			2: {
				audio: "shensu1",
				trigger: { player: "phaseUseBefore" },
				sourceSkill: "qj_shensu",
				filter(event, player) {
					return (
						player.countCards("he", function (card) {
							if (_status.connectMode) {
								return true;
							}
							return get.type(card) == "equip";
						}) > 0
					);
				},
				async cost(event, trigger, player) {
					event.result = await player
						.chooseCardTarget({
							prompt: get.prompt("qj_shensu"),
							prompt2: "弃置一张装备牌并跳过出牌阶段，视为对一名其他角色使用一张【杀】",
							filterCard(card, player) {
								return get.type(card) == "equip" && lib.filter.cardDiscardable(card, player);
							},
							position: "he",
							filterTarget(card, player, target) {
								if (player == target) {
									return false;
								}
								return player.canUse({ name: "sha" }, target, false);
							},
							ai1(card) {
								if (_status.event.check) {
									return 0;
								}
								return 6 - get.value(card);
							},
							ai2(target) {
								if (_status.event.check) {
									return 0;
								}
								return get.effect(target, { name: "sha" }, _status.event.player);
							},
							check:
								player.countCards("hs", i => {
									return player.hasValueTarget(i, null, true);
								}) >
								player.hp - 1,
						})
						.setHiddenSkill(event.skill)
						.forResult();
				},
				async content(event, trigger, player) {
					trigger.cancel();
					await player.discard(event.cards[0]);
					await player.useCard({ name: "sha", isCard: true }, event.targets[0], false);
				},
			},
			3: {
				audio: "shensu1",
				trigger: {
					player: "phaseDiscardBegin",
				},
				sourceSkill: "qj_shensu",
				/**
				 * @param {GameEvent} _event
				 * @param {PlayerGuozhan} player
				 * @returns {boolean}
				 */
				filter(_event, player) {
					return player.hp > 0;
				},
				/**
				 * @param {GameEvent} event
				 * @param {GameEvent} _trigger
				 * @param {PlayerGuozhan} player
				 */
				async cost(event, _trigger, player) {
					event.result = await player
						.chooseTarget(get.prompt("qj_shensu"), "失去1点体力并跳过弃牌阶段，视为对一名其他角色使用一张无距离限制的【杀】", (card, player, target) => player.canUse("sha", target, false))
						.setHiddenSkill("qj_shensu")
						.set("goon", player.needsToDiscard())
						.set("ai", target => {
							var player = _status.event.player;
							if (!_status.event.goon || player.hp <= target.hp) {
								return false;
							}
							return get.effect(target, { name: "sha", isCard: true }, player, player);
						})
						.forResult();
				},
				logTarget: "targets",
				/**
				 * @param {GameEvent} event
				 * @param {GameEvent} trigger
				 * @param {PlayerGuozhan} player
				 */
				async content(event, trigger, player) {
					const { targets } = event;
					const target = targets[0];
					await player.loseHp();
					trigger.cancel();
					await player.useCard({ name: "sha", isCard: true }, target, false);
				},
			},
		},
	},
	qj_shebian: {
		audio: "shebian",
		trigger: {
			player: "loseHpAfter",
		},
		filter(event, player) {
			return player.canMoveCard() && event.num > 0;
		},
		check(event, player) {
			return player.canMoveCard(true);
		},
		async content(event, trigger, player) {
			await player.moveCard(true);
		},
	},
	qj_qiaobian: {
		audio: "qiaobian",
		audioname2: { gz_jun_caocao: "jianan_qiaobian" },
		trigger: {
			player: ["phaseJudgeBefore", "phaseDrawBefore", "phaseUseBefore", "phaseDiscardBefore"],
		},
		filter(event, player) {
			return player.countCards("he") > 0;
		},
		preHidden: true,
		async cost(event, trigger, player) {
			let check,
				str = "弃置一张牌并跳过";
			str += ["判定", "摸牌", "出牌", "弃牌"][lib.skill.qj_qiaobian.trigger.player.indexOf(event.triggername)];
			str += "阶段";
			if (trigger.name == "phaseDraw") {
				str += "，然后可以获得至多两名角色各一张手牌";
			}
			if (trigger.name == "phaseUse") {
				str += "，然后可以移动场上的一张牌";
			}
			switch (trigger.name) {
				case "phaseJudge":
					check = player.countCards("j");
					break;
				case "phaseDraw": {
					let i,
						num = 0,
						num2 = 0;
					const players = game.filterPlayer();
					for (i = 0; i < players.length; i++) {
						if (player != players[i] && players[i].countCards("h")) {
							const att = get.attitude(player, players[i]);
							if (att <= 0) {
								num++;
							}
							if (att < 0) {
								num2++;
							}
						}
					}
					check = num >= 2 && num2 > 0;
					break;
				}
				case "phaseUse":
					if (!player.canMoveCard(true)) {
						check = false;
					} else {
						check = game.hasPlayer(function (current) {
							return get.attitude(player, current) > 0 && current.countCards("j");
						});
						if (!check) {
							if (player.countCards("h") > player.hp + 1) {
								check = false;
							} else if (player.countCards("h", { name: "wuzhong" })) {
								check = false;
							} else {
								check = true;
							}
						}
					}
					break;
				case "phaseDiscard":
					check = player.needsToDiscard();
					break;
			}
			event.result = await player
				.chooseToDiscard("he", str, lib.filter.cardDiscardable)
				.set("ai", card => {
					if (!_status.event.check) {
						return -1;
					}
					return 7 - get.value(card);
				})
				.set("check", check)
				.setHiddenSkill(event.skill)
				.forResult();
		},
		async content(event, trigger, player) {
			trigger.cancel();
			game.log(player, "跳过了", "#y" + ["判定", "摸牌", "出牌", "弃牌"][lib.skill.qiaobian.trigger.player.indexOf(event.triggername)] + "阶段");
			if (trigger.name == "phaseUse") {
				if (player.canMoveCard()) {
					await player.moveCard();
				}
			} else if (trigger.name == "phaseDraw") {
				const { result } = await player
					.chooseTarget([1, 2], "获得至多两名角色各一张手牌", function (card, player, target) {
						return target != player && target.countCards("h");
					})
					.set("ai", function (target) {
						return 1 - get.attitude(_status.event.player, target);
					});
				if (!result.bool) {
					return;
				}
				result.targets.sortBySeat();
				player.line(result.targets, "green");
				if (!result.targets.length) {
					return;
				}
				await player.gainMultiple(result.targets);
				await game.delay();
			}
		},
		ai: { threaten: 3 },
	},
	qj_duanliang: {
		audio: "duanliang",
		locked: false,
		enable: "chooseToUse",
		filterCard(card) {
			return get.type2(card) != "trick" && get.color(card) == "black";
		},
		filter(event, player) {
			return player.hasCard(card => get.type2(card) != "trick" && get.color(card) == "black", "hes");
		},
		position: "hes",
		viewAs: {
			name: "bingliang",
		},
		prompt: "将一张黑色非锦囊牌当做兵粮寸断使用",
		check(card) {
			return 6 - get.value(card);
		},
		ai: {
			order: 9,
			basic: {
				order: 1,
				useful(card, i) {
					let player = _status.event.player;
					if (_status.event.isPhaseUsing()) {
						return game.hasPlayer(cur => {
							return cur !== player && lib.filter.judge(card, player, cur) && get.effect(cur, card, player, player) > 0;
						})
							? 3.2
							: 1;
					}
					return 0.6;
				},
				value: 4,
			},
			result: {
				target(player, target) {
					if (target.hasJudge("caomu")) {
						return 0;
					}
					return -2.7 / Math.sqrt(target.countCards("h") + 1);
				},
			},
			tag: {
				skip: "phaseDraw",
			},
		},
		mod: {
			targetInRange(card, player, target) {
				if (card.name == "bingliang" && !player.getStat("damage")) {
					return true;
				}
			},
		},
	},
	qj_jiezi: {
		trigger: {
			global: ["phaseDrawSkipped", "phaseDrawCancelled"],
		},
		audio: "jiezi",
		preHidden: true,
		frequent: true,
		filter(event, player) {
			return event.player != player;
		},
		async content(event, trigger, player) {
			await player.draw();
		},
	},
	qj_weikui: {
		audio: "weikui",
		enable: "phaseUse",
		usable: 1,
		filterTarget(card, player, target) {
			return target != player && target.countCards("h");
		},
		async content(event, trigger, player) {
			await player.loseHp();
			let target = event.target;
			if (target.countCards("h", "shan")) {
				player.viewHandcards(target);
				if (player.canUse({ name: "sha", isCard: true }, target, false)) {
					player.useCard({ name: "sha", isCard: true }, target, false);
				}
				player.storage.qj_weikui_buff = target;
				player.addTempSkill("qj_weikui_buff");
			} else {
				player.discardPlayerCard(target, "visible", true, "h").set("ai", function (button) {
					return get.value(button.link, _status.event.target);
				});
			}
		},
		subSkill: {
			buff: {
				onremove: true,
				mod: {
					globalFrom(from, to) {
						if (to == from.storage.qj_weikui_buff) {
							return -Infinity;
						}
					},
				},
				mark: "character",
				intro: {
					content: "与$的距离视为1直到回合结束",
				},
			},
		},
		ai: {
			order: 8,
			result: {
				target(player, target) {
					if (player.hp <= 2) {
						return 0;
					}
					if (player.hp == 3) {
						return target.hp <= 2 ? -1 : 0;
					}
					return -1;
				},
			},
		},
	},
	qj_lizhan: {
		audio: "lizhan",
		trigger: {
			player: "phaseJieshuBegin",
		},
		preHidden: true,
		filter(event, player) {
			for (var i = 0; i < game.players.length; i++) {
				if (game.players[i].isDamaged()) {
					return true;
				}
			}
			return false;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt("lizhan"), "令任意名已受伤的角色各摸一张牌", [1, Infinity], function (card, player, target) {
					return target.isDamaged();
				})
				.set("ai", function (target) {
					return get.attitude(player, target);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			player.logSkill("qj_lizhan", event.targets);
			game.asyncDraw(event.targets);
		},
		ai: {
			expose: 0.3,
			threaten: 1.3,
		},
	},
	qj_qiangxi: {
		audio: "qiangxi",
		mod: {
			aiOrder(player, card, num) {
				if (player.getEquips(1).length || get.subtype(card, player) !== "equip1" || !player.hasSkillTag("noe")) {
					return num;
				}
				return 10;
			},
		},
		enable: "phaseUse",
		locked: false,
		filter(event, player) {
			if (player.hp < 1 && !player.hasCard(card => lib.skill.qj_qiangxi.filterCard(card), "he")) {
				return false;
			}
			return game.hasPlayer(current => lib.skill.qj_qiangxi.filterTarget(null, player, current));
		},
		filterCard(card) {
			return get.subtype(card) == "equip1";
		},
		position: "he",
		filterTarget(card, player, target) {
			if (target == player) {
				return false;
			}
			var stat = player.getStat()._qj_qiangxi;
			return player.inRange(target) && (!stat || !stat.includes(target));
		},
		selectCard() {
			if (_status.event.player.hp < 1) {
				return 1;
			}
			return [0, 1];
		},
		async content(event, trigger, player) {
			var stat = player.getStat();
			if (!stat._qj_qiangxi) {
				stat._qj_qiangxi = [];
			}
			stat._qj_qiangxi.push(event.target);
			if (!event.cards.length) {
				await player.loseHp();
			}
			event.target.damage("nocard");
		},
		ai: {
			damage: true,
			order: 8,
			result: {
				player(player, target) {
					if (ui.selected.cards.length) {
						return 0;
					}
					if (player.hp >= target.hp) {
						return -0.9;
					}
					if (player.hp <= 2) {
						return -10;
					}
					return get.effect(player, { name: "losehp" }, player, player);
				},
				target(player, target) {
					if (!ui.selected.cards.length) {
						if (player.hp < 2) {
							return 0;
						}
						if (player.hp == 2 && target.hp >= 2) {
							return 0;
						}
						if (target.hp > player.hp) {
							return 0;
						}
					}
					return get.damageEffect(target, player, target);
				},
			},
			threaten: 1.5,
		},
	},
	qj_quhu: {
		audio: "quhu",
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			if (player.countCards("h") == 0) {
				return false;
			}
			return game.hasPlayer(function (current) {
				return current.hp > player.hp && player.canCompare(current);
			});
		},
		filterTarget(card, player, target) {
			return target.hp > player.hp && player.canCompare(target);
		},
		async content(event, trigger, player) {
			const target = event.target;
			const bool = await player.chooseToCompare(target).forResultBool();
			if (!bool) {
				return void (await player.damage(target));
			}
			if (
				!game.hasPlayer(function (player) {
					return player != target && target.inRange(player);
				})
			) {
				return;
			}
			const { result } = await player
				.chooseTarget(function (card, player, target) {
					const source = _status.event.source;
					return target != source && source.inRange(target);
				}, true)
				.set("ai", function (target) {
					return get.damageEffect(target, _status.event.source, player);
				})
				.set("source", target);
			if (!result.bool || !result.targets || !result.targets.length) {
				return;
			}
			target.line(result.targets[0], "green");
			await result.targets[0].damage(target);
		},
		ai: {
			order: 0.5,
			result: {
				target(player, target) {
					const att = get.attitude(player, target);
					const oc = target.countCards("h") == 1;
					if (att > 0 && oc) {
						return 0;
					}
					const players = game.filterPlayer();
					for (let i = 0; i < players.length; i++) {
						if (players[i] != target && players[i] != player && target.inRange(players[i])) {
							if (get.damageEffect(players[i], target, player) > 0) {
								return att > 0 ? att / 2 : att - (oc ? 5 : 0);
							}
						}
					}
					return 0;
				},
				player(player, target) {
					if (target.hasSkillTag("jueqing", false, target)) {
						return -10;
					}
					const hs = player.getCards("h");
					let mn = 1;
					for (let i = 0; i < hs.length; i++) {
						mn = Math.max(mn, get.number(hs[i]));
					}
					if (mn <= 11 && player.hp < 2) {
						return -20;
					}
					let max = player.maxHp - hs.length;
					const players = game.filterPlayer();
					for (let i = 0; i < players.length; i++) {
						if (get.attitude(player, players[i]) > 2) {
							max = Math.max(Math.min(5, players[i].hp) - players[i].countCards("h"), max);
						}
					}
					switch (max) {
						case 0:
							return mn == 13 ? 0 : -20;
						case 1:
							return mn >= 12 ? 0 : -15;
						case 2:
							return 0;
						case 3:
							return 1;
						default:
							return max;
					}
				},
			},
			expose: 0.2,
		},
	},
	qj_jieming: {
		audio: "jieming",
		trigger: {
			player: "damageEnd",
		},
		preHidden: true,
		getIndex(event) {
			return event.num;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), function (card, player, target) {
					return true; //target.countCards('h')<Math.min(target.maxHp,5); // 没有卷入格式化大劫的上古代码碎片喵
				})
				.set("ai", function (target) {
					let att = get.attitude(_status.event.player, target);
					if (target.hasSkillTag("nogain")) {
						att /= 6;
					}
					if (att > 2) {
						return Math.max(0, Math.min(5, target.maxHp) - target.countCards("h"));
					}
					return att / 3;
				})
				.forResult();
		},
		async content(event, trigger, player) {
			for (const target of event.targets) {
				await target.drawTo(Math.min(5, target.maxHp));
			}
		},
		ai: {
			maixie: true,
			maixie_hp: true,
			effect: {
				target(card, player, target, current) {
					if (get.tag(card, "damage") && target.hp > 1) {
						if (player.hasSkillTag("jueqing", false, target)) {
							return [1, -2];
						}
						const players = game.filterPlayer();
						let max = 0;
						for (let i = 0; i < players.length; i++) {
							if (get.attitude(target, players[i]) > 0) {
								max = Math.max(Math.min(5, players[i].hp) - players[i].countCards("h"), max);
							}
						}
						switch (max) {
							case 0:
								return 2;
							case 1:
								return 1.5;
							case 2:
								return [1, 2];
							default:
								return [0, max];
						}
					}
					if ((card.name == "tao" || card.name == "caoyao") && target.hp > 1 && target.countCards("h") <= target.hp) {
						return [0, 0];
					}
				},
			},
		},
	},
	qj_xingshang: {
		audio: "xingshang",
		audioname2: {
			caoying: "lingren_xingshang",
		},
		trigger: {
			global: "die",
		},
		filter(event, player) {
			return player.isDamaged() || event.player.countCards("he") > 0;
		},
		preHidden: true,
		frequent: true,
		async content(event, trigger, player) {
			event.togain = trigger.player.getCards("he");
			if (event.togain.length > 0) {
				player.gain(event.togain, trigger.player, "giveAuto", "bySelf");
			} else {
				player.recover();
			}
		},
	},
	qj_fangzhu: {
		audio: "fangzhu",
		trigger: {
			player: "damageEnd",
		},
		preHidden: true,
		filter(event, player) {
			return game.hasPlayer(current => player != current && !current.isTurnedOver());
		},
		async cost(event, trigger, player) {
			const draw = player.getDamagedHp();
			event.result = await player
				.chooseTarget(get.prompt(event.skill), "令一名其他角色叠置并摸两张牌", function (card, player, target) {
					return player != target && !target.isTurnedOver();
				})
				.setHiddenSkill(event.skill)
				.set("ai", target => {
					if (target.hasSkillTag("noturn")) {
						return 0;
					}
					const player = _status.event.player;
					const current = _status.currentPhase;
					const dis = current ? get.distance(current, target, "absolute") : 1;
					const att = get.attitude(player, target);
					if (att == 0) {
						return target.hasJudge("lebu") ? Math.random() / 3 : Math.sqrt(get.threaten(target)) / 5 + Math.random() / 2;
					}
					if (att > 0) {
						return -1;
					} else {
						if (current && target.getSeatNum() <= current.getSeatNum()) {
							return -att + 1;
						}
						return 2.25 * 10 * Math.sqrt(Math.max(0.01, get.threaten(target))) + (2 * game.countPlayer()) / dis;
					}
				})
				.forResult();
		},
		async content(event, trigger, player) {
			await event.targets[0].draw(2);
			await event.targets[0].turnOver();
			if (event.targets[0].countCards("he") >= 4) {
				let result = await event.targets[0]
					.chooseToDiscard("he", 4)
					.set("ai", function (card) {
						if (event.targets[0].getDamagedHp() > 2) {
							return -1;
						}
						return player.hp * player.hp - get.value(card);
					})
					.set("prompt", "弃置四张牌并平置，若牌名字数之和大于7，失去1点体力。")
					.forResult();
				if (result.bool) {
					await event.targets[0].turnOver();
					let sum = 0;
					for (let card of result.cards) {
						sum += get.cardNameLength(card);
					}
					if (sum > 7) {
						await event.targets[0].loseHp();
					}
				}
			}
		},
		ai: {
			maixie: true,
			maixie_hp: true,
			effect: {
				target(card, player, target) {
					if (get.tag(card, "damage")) {
						if (player.hasSkillTag("jueqing", false, target)) {
							return [1, -1.5];
						}
						if (target.hp <= 1) {
							return;
						}
						if (!target.hasFriend()) {
							return;
						}
						var hastarget = false;
						var turnfriend = false;
						var players = game.filterPlayer();
						for (var i = 0; i < players.length; i++) {
							if (get.attitude(target, players[i]) < 0 && !players[i].isTurnedOver()) {
								hastarget = true;
							}
						}
						if (get.attitude(player, target) > 0 && !hastarget) {
							return;
						}
						if (turnfriend || target.hp == target.maxHp) {
							return [0.5, 1];
						}
						if (target.hp > 1) {
							return [1, 0.5];
						}
					}
				},
			},
		},
	},
	qj_xiaoguo: {
		audio: "xiaoguo",
		audioname2: { gz_jun_caocao: "jianan_xiaoguo" },
		trigger: { global: "phaseZhunbeiBegin" },
		filter(event, player) {
			return (
				event.player != player &&
				player.countCards("h", card => {
					if (_status.connectMode) {
						return true;
					}
					return get.type(card) == "basic" && lib.filter.cardDiscardable(card, player);
				})
			);
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseToDiscard(
					get.prompt2("qj_xiaoguo", trigger.player),
					(card, player) => {
						return get.type(card) == "basic";
					},
					[1, Infinity]
				)
				.set("complexSelect", true)
				.set("ai", card => {
					const player = get.event("player"),
						target = get.event().getTrigger().player;
					const effect = get.damageEffect(target, player, player);
					const cards = target.getCards("e", card => get.attitude(player, target) * get.value(card, target) < 0);
					if (effect <= 0 && !cards.length) {
						return 0;
					}
					if (ui.selected.cards.length > cards.length - (effect <= 0 ? 1 : 0)) {
						return 0;
					}
					return 1 / (get.value(card) || 0.5);
				})
				.set("logSkill", ["qj_xiaoguo", trigger.player])
				.setHiddenSkill("qj_xiaoguo")
				.forResult();
		},
		popup: false,
		preHidden: true,
		async content(event, trigger, player) {
			const num = trigger.player.countCards("e"),
				num2 = event.cards.length;
			await player.discardPlayerCard(trigger.player, "e", num2, true);
			if (num2 > num) {
				await trigger.player.damage();
				player.draw(1);
			}
		},
	},
	qj_rende: {
		audio: "rende",
		audioname: ["gz_jun_liubei"],
		enable: "phaseUse",
		filter(event, player) {
			return player.countCards("h") && game.hasPlayer(current => get.info("qj_rende").filterTarget(null, player, current));
		},
		filterTarget(card, player, target) {
			if (player == target) {
				return false;
			}
		},
		filterCard: true,
		selectCard: [1, Infinity],
		allowChooseAll: true,
		discard: false,
		lose: false,
		delay: false,
		check(card) {
			if (ui.selected.cards.length && ui.selected.cards[0].name == "du") {
				return 0;
			}
			if (!ui.selected.cards.length && card.name == "du") {
				return 20;
			}
			var player = get.owner(card);
			if (ui.selected.cards.length >= Math.max(2, player.countCards("h") - player.hp)) {
				return 0;
			}
			if (player.hp == player.maxHp || player.countMark("qj_rende") < 0 || player.countCards("h") <= 1) {
				var players = game.filterPlayer();
				for (var i = 0; i < players.length; i++) {
					if (players[i].hasSkill("haoshi") && !players[i].isTurnedOver() && !players[i].hasJudge("lebu") && get.attitude(player, players[i]) >= 3 && get.attitude(players[i], player) >= 3) {
						return 11 - get.value(card);
					}
				}
				if (player.countCards("h") > player.hp) {
					return 10 - get.value(card);
				}
				if (player.countCards("h") > 2) {
					return 6 - get.value(card);
				}
				return -1;
			}
			return 10 - get.value(card);
		},
		async content(event, trigger, player) {
			const { target, cards, name } = event;
			let num = 0;
			player.getHistory("lose", evt => {
				if (evt.getParent(2).name == name && evt.getParent("phaseUse") == event.getParent(3)) {
					num += evt.cards.length;
				}
			});
			if (!player.storage[event.name]) {
				player.when({ player: "phaseUseEnd" }).step(async () => {
					player.clearMark(event.name, false);
				});
			}
			player.addMark(event.name, num + cards.length, false);
			await player.give(cards, target);
			const list = get.inpileVCardList(info => {
				return (
					info[0] == "basic" &&
					player.hasUseTarget(
						new lib.element.VCard({
							name: info[2],
							nature: info[3],
						}),
						null,
						true
					)
				);
			});
			if (num < 2 && num + cards.length > 1 && list.length) {
				const { result } = await player.chooseButton(["是否视为使用一张基本牌？", [list, "vcard"]]).set("ai", button => {
					return get.player().getUseValue({
						name: button.link[2],
						nature: button.link[3],
						isCard: true,
					});
				});
				if (!result?.links?.length) {
					return;
				}
				await player.chooseUseTarget(
					get.autoViewAs({
						name: result.links[0][2],
						nature: result.links[0][3],
						isCard: true,
					}),
					true
				);
			}
		},
		ai: {
			fireAttack: true,
			order(skill, player) {
				if (player.hp < player.maxHp && player.countMark("qj_rende") < 2 && player.countCards("h") > 1) {
					return 10;
				}
				return 4;
			},
			result: {
				target(player, target) {
					if (target.hasSkillTag("nogain")) {
						return 0;
					}
					if (ui.selected.cards.length && ui.selected.cards[0].name == "du") {
						if (target.hasSkillTag("nodu")) {
							return 0;
						}
						return -10;
					}
					if (target.hasJudge("lebu")) {
						return 0;
					}
					var nh = target.countCards("h");
					var np = player.countCards("h");
					if (player.hp == player.maxHp || player.countMark("qj_rende") < 0 || player.countCards("h") <= 1) {
						if (nh >= np - 1 && np <= player.hp && !target.hasSkill("haoshi")) {
							return 0;
						}
					}
					return Math.max(1, 5 - nh);
				},
			},
			effect: {
				target_use(card, player, target) {
					if (player == target && get.type(card) == "equip") {
						if (
							player.countCards("e", {
								subtype: get.subtype(card),
							})
						) {
							if (game.hasPlayer(current => current != player && get.attitude(player, current) > 0)) {
								return 0;
							}
						}
					}
				},
			},
			threaten: 0.8,
		},
		marktext: "仁",
		onremove: true,
		intro: {
			content: "本阶段已仁德牌数：#",
			onunmark: true,
		},
		subSkill: {
			targeted: {
				onremove: true,
				charlotte: true,
			},
		},
	},
	qj_wusheng: {
		group: "qj_wusheng_heart",
		mod: {
			targetInRange(card) {
				if (get.suit(card) == "diamond" && card.name == "sha") {
					return true;
				}
			},
		},
		locked: false,
		audio: "wusheng",
		audioname2: {
			gz_jun_liubei: "shouyue_wusheng",
		},
		enable: ["chooseToRespond", "chooseToUse"],
		filterCard(card, player) {
			if (get.zhu(player, "shouyue")) {
				return true;
			}
			return get.color(card) == "red";
		},
		position: "hes",
		viewAs: {
			name: "sha",
		},
		viewAsFilter(player) {
			if (get.zhu(player, "shouyue")) {
				if (!player.countCards("hes")) {
					return false;
				}
			} else {
				if (!player.countCards("hes", { color: "red" })) {
					return false;
				}
			}
		},
		prompt: "将一张红色牌当杀使用或打出",
		check(card) {
			var val = get.value(card);
			if (_status.event.name == "chooseToRespond") {
				return 1 / Math.max(0.1, val);
			}
			return 5 - val;
		},
		ai: {
			respondSha: true,
			skillTagFilter(player) {
				if (get.zhu(player, "shouyue")) {
					if (!player.countCards("hes")) {
						return false;
					}
				} else {
					if (!player.countCards("hes", { color: "red" })) {
						return false;
					}
				}
			},
		},
		subSkill: {
			heart: {
				audio: "wusheng",
				preHidden: true,
				trigger: { source: "damageSource" },
				filter(event, player) {
					if (event._notrigger.includes(event.player)) {
						return false;
					}
					return event.card && event.card.name == "sha" && get.suit(event.card) == "heart" && event.getParent().name == "sha" && event.player.isIn() && event.player.countCards("e") > 0;
				},
				check(event, player) {
					return get.attitude(player, event.player) < 0;
				},
				async content(event, trigger, player) {
					await player.useCard({ name: "shuiyan", isCard: true }, trigger.player, false);
				},
			},
		},
	},
	qj_paoxiao: {
		audio: "paoxiao",
		audioname2: {
			gz_jun_liubei: "shouyue_paoxiao",
		},
		trigger: {
			player: "useCard",
		},
		filter(event, player) {
			// @ts-expect-error 类型系统未来可期
			if (_status.currentPhase != player) {
				return false;
			}
			if (event.card.name != "sha") {
				return false;
			}
			const history = player.getHistory("useCard", evt => {
				return evt.card.name == "sha";
			});
			return history && history.indexOf(event) == 1;
		},
		forced: true,
		locked: true,
		async content(_event, _trigger, player) {
			await player.draw();
		},
		mod: {
			cardUsable(card, player, num) {
				if (card.name == "sha") {
					return Infinity;
				}
			},
		},
		ai: {
			unequip: true,
			skillTagFilter(player, tag, arg) {
				if (!get.zhu(player, "shouyue")) {
					return false;
				}
				if (arg && arg.name == "sha") {
					return true;
				}
				return false;
			},
		},
	},
	qj_guanxing: {
		audio: "guanxing",
		audioname: ["qj_jiangwei"],
		trigger: { player: ["phaseZhunbeiBegin", "phaseJieshuBegin"] },
		frequent: true,
		preHidden: true,
		filter(event, player, name) {
			if (name == "phaseJieshuBegin") {
				return player.hasSkill("reguanxing_on");
			}
			return true;
		},
		async content(event, trigger, player) {
			const result = await player
				.chooseToGuanxing(game.countPlayer() < 4 ? 3 : 5)
				.set("prompt", "观星：点击或拖动将牌移动到牌堆顶或牌堆底")
				.forResult();
			if ((!result.bool || !result.moved[0].length) && event.triggername == "phaseZhunbeiBegin") {
				player.addTempSkill(["reguanxing_on", "guanxing_fail"]);
			}
		},
		subSkill: {
			on: { charlotte: true },
		},
		ai: {
			guanxing: true,
		},
	},
	qj_kongcheng: {
		init(player) {
			if (player.checkMainSkill("qj_kongcheng")) {
				player.removeMaxHp();
			}
		},
		mainSkill: true,
		audio: "kongcheng",
		trigger: {
			player: "loseAfter",
			global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
		},
		forced: true,
		filter(event, player) {
			return player.countCards("h") == 0 && event.getl(player).hs.length > 0;
		},
		async content(event, trigger, player) {
			player.addSkill("qj_kongcheng_effect");
			player.addSkill("qj_kongcheng_remove");
		},
		ai: {
			noh: true,
			skillTagFilter(player, tag) {
				if (tag == "noh") {
					if (player.countCards("h") != 1) {
						return false;
					}
				}
			},
		},
		subSkill: {
			effect: {
				sourceSkill: "kongcheng",
				trigger: { target: ["shaBefore", "useCardToBefore"] },
				forced: true,
				audio: "kongcheng",
				priority: 15,
				filter(event, player) {
					return event.card.name == "sha" || event.card.name == "juedou";
				},
				async content(event, trigger, player) {
					trigger.cancel();
				},
				ai: {
					effect: {
						target(card, player, target) {
							if (card.name == "sha" || card.name == "juedou") {
								return "zeroplayertarget";
							}
						},
					},
				},
			},
			remove: {
				charlotte: true,
				trigger: {
					player: "gainAfter",
					global: "loseAsyncAfter",
				},
				forced: true,
				filter(event, player) {
					return event.getg(player).length != 0;
				},
				async content(event, trigger, player) {
					player.removeSkill("qj_kongcheng_effect");
					player.removeSkill("qj_kongcheng_remove");
				},
			},
		},
	},
	qj_longdan: {
		audio: "longdan_sha",
		audioname2: { gz_jun_liubei: "shouyue_longdan" },
		subSkill: {
			shamiss: {
				sub: true,
				audio: "longdan_sha",
				audioname2: { gz_jun_liubei: "shouyue_longdan" },
				trigger: {
					player: "shaMiss",
				},
				filter(event, player) {
					return event.skill == "gz_longdan_sha";
				},
				async cost(event, trigger, player) {
					event.result = await player
						.chooseTarget("是否发动【龙胆】对一名其他角色造成1点伤害？", function (card, player, target) {
							return target != _status.event?.target && target != player;
						})
						.set("ai", function (target) {
							return -get.attitude(_status.event?.player, target);
						})
						.set("target", trigger.target)
						.forResult();
				},
				logTarget: "targets",
				async content(event, _trigger, _player) {
					await player.damage(event.targets[0]);
				},
			},
			draw: {
				trigger: {
					player: ["useCard", "respond"],
				},
				audio: "longdan_sha",
				audioname2: { gz_jun_liubei: "shouyue_longdan" },
				forced: true,
				locked: false,
				filter(event, player) {
					if (!get.zhu(player, "shouyue")) {
						return false;
					}
					return event.skill == "gz_longdan_sha" || event.skill == "gz_longdan_shan";
				},
				async content(_event, _trigger, player) {
					player.draw();
					//player.storage.fanghun2++;
				},
				sub: true,
			},
			sha: {
				audio: "longdan_sha",
				audioname2: { gz_jun_liubei: "shouyue_longdan" },
				enable: ["chooseToUse", "chooseToRespond"],
				filterCard: {
					name: "shan",
				},
				viewAs: {
					name: "sha",
				},
				position: "hs",
				viewAsFilter(player) {
					if (!player.countCards("hs", "shan")) {
						return false;
					}
				},
				prompt: "将一张闪当杀使用或打出",
				check() {
					return 1;
				},
				ai: {
					effect: {
						target(card, player, target, current) {
							if (get.tag(card, "respondSha") && current < 0) {
								return 0.6;
							}
						},
					},
					respondSha: true,
					skillTagFilter(player) {
						if (!player.countCards("hs", "shan")) {
							return false;
						}
					},
					order() {
						return get.order({ name: "sha" }) + 0.1;
					},
				},
				sub: true,
			},
			shan: {
				audio: "longdan_sha",
				audioname2: { gz_jun_liubei: "shouyue_longdan" },
				enable: ["chooseToRespond", "chooseToUse"],
				filterCard: {
					name: "sha",
				},
				viewAs: {
					name: "shan",
				},
				position: "hs",
				prompt: "将一张杀当闪使用或打出",
				check() {
					return 1;
				},
				viewAsFilter(player) {
					if (!player.countCards("hs", "sha")) {
						return false;
					}
				},
				ai: {
					respondShan: true,
					skillTagFilter(player) {
						if (!player.countCards("hs", "sha")) {
							return false;
						}
					},
					effect: {
						target(card, player, target, current) {
							if (get.tag(card, "respondShan") && current < 0) {
								return 0.6;
							}
						},
					},
				},
				sub: true,
			},
		},
		tao: {
			audio: "longdan_sha",
			audioname2: { gz_jun_liubei: "shouyue_longdan" },
			enable: ["chooseToUse", "chooseToRespond"],
			filterCard: {
				name: "jiu",
			},
			viewAs: {
				name: "tao",
			},
			position: "hs",
			viewAsFilter(player) {
				if (!player.countCards("hs", "jiu")) {
					return false;
				}
			},
			prompt: "将一张酒当桃使用或打出",
			check() {
				return 1;
			},
			ai: {
				order() {
					if (player && _status.event.type == "phase") {
						if (player.countCards("hs", "jiu") > 0 && player.getUseValue({ name: "tao" }) > 0) {
							var temp = get.order({ name: "tao" });
							return temp > 0 ? temp + 0.3 : 0;
						}
					}
					return 4;
				},
			},
			sub: true,
		},
		jiu: {
			audio: "longdan_sha",
			audioname2: { gz_jun_liubei: "shouyue_longdan" },
			enable: ["chooseToUse", "chooseToRespond"],
			filterCard: {
				name: "tao",
			},
			viewAs: {
				name: "jiu",
			},
			position: "hs",
			viewAsFilter(player) {
				if (!player.countCards("hs", "tao")) {
					return false;
				}
			},
			prompt: "将一张桃当酒使用或打出",
			check() {
				return 1;
			},
			ai: {
				order() {
					if (player && _status.event.type == "phase") {
						if (player.countCards("hs", "tao") > 1 && player.getUseValue({ name: "jiu" }) > 0) {
							var temp = get.order({ name: "jiu" });
							return temp > 0 ? temp + 0.3 : 0;
						}
					}
					return 4;
				},
				sub: true,
			},
		},
	},
	qj_mashu: {
		mod: {
			globalFrom(from, to, distance) {
				return distance - 1;
			},
		},
	},
	qj_tieji: {
		audio: "retieji",
		preHidden: true,
		audioname2: {
			gz_jun_liubei: "shouyue_tieji",
		},
		trigger: {
			player: "useCardToPlayered",
		},
		check(event, player) {
			return get.attitude(player, event.target) < 0;
		},
		filter(event) {
			return event.card.name == "sha";
		},
		logTarget: "target",
		async content(_event, trigger, player) {
			const { target } = trigger;

			/** @type {string[]} */
			const addingSkills = [];
			const targetMainShowing = !target.isUnseen(0);
			const targetViceShowing = !target.isUnseen(1);
			if (get.zhu(player, "shouyue")) {
				if (targetMainShowing) {
					addingSkills.push("fengyin_main");
				}
				if (targetViceShowing) {
					addingSkills.push("fengyin_vice");
				}
			} else {
				const controls = [];
				if (targetMainShowing && !target.hasSkill("fengyin_main")) {
					controls.push("主将");
				}
				if (targetViceShowing && !target.hasSkill("fengyin_vice")) {
					controls.push("副将");
				}

				/** @type {?Partial<Result>} */
				let result = null;

				if (controls.length == 1) {
					result = { control: controls[0] };
				} else if (controls.length > 1) {
					result = await player
						.chooseControl(controls)
						.set("ai", () => {
							let choice = "主将";
							const skills = lib.character[target.name2][3];
							for (const skill of skills) {
								const info = get.info(skill);
								if (info?.ai?.maixie) {
									choice = "副将";
									break;
								}
							}
							return choice;
						})
						.set("prompt", `请选择一个武将牌，令${get.translation(target)}该武将牌上的非锁定技全部失效。`)
						.forResult();
				}

				if (result?.control) {
					const map = {
						主将: "fengyin_main",
						副将: "fengyin_vice",
					};

					addingSkills.push(map[result.control]);
				}
			}

			addingSkills.forEach(skill => {
				target.addTempSkill(skill);
			});

			const result = await player.judge(() => 0).forResult();

			// @ts-expect-error 类型系统未来可期
			const suit = get.suit(result.card);
			const num = target.countCards("h", "shan");
			const result2 = await target
				.chooseToDiscard("请弃置一张" + get.translation(suit) + "牌，否则不能使用闪抵消此杀", "he", function (card) {
					// @ts-expect-error 类型系统未来可期
					return get.suit(card) == get.event().suit;
				})
				.set("ai", card => {
					const num = get.event().num;
					if (num == 0) {
						return 0;
					}
					if (card.name == "shan") {
						return num > 1 ? 2 : 0;
					}
					return 8 - get.value(card);
				})
				.set("num", num)
				.set("suit", suit)
				.forResult();

			if (!result2.bool) {
				// @ts-expect-error 类型系统未来可期
				trigger.getParent().directHit.add(trigger.target);
			}
		},
	},
	qj_jizhi: {
		audio: "jizhi",
		audioname: ["jianyong"],
		audioname2: {
			xin_simayi: "jilue_jizhi",
		},
		trigger: { player: "useCard" },
		frequent: true,
		preHidden: true,
		filter(event) {
			return get.type(event.card) == "trick" && event.card.isCard && event.cards && event.cards.length;
		},
		async content(event, trigger, player) {
			player.draw();
		},
		ai: {
			threaten: 1.4,
			noautowuxie: true,
		},
	},
	qj_cangji: {
		preHidden: true,
		trigger: {
			player: "loseBefore",
		},
		filter(event, player) {
			if (player.hasSkill("qj_cangji_used")) {
				return false;
			}
			if (event.type != "discard") {
				return false;
			}
			var cards1 = player.getEquips("fangju");
			var cards2 = player.getEquips("baowu");
			return event.cards.some(card => cards1.includes(card) || cards2.includes(card));
		},
		async content(event, trigger, player) {
			let cards = [];
			let cards1 = player.getEquips("fangju");
			let cards2 = player.getEquips("baowu");
			for (card in event.cards) {
				if (cards1.includes(card) || cards2.includes(card)) {
					cards.push(card);
				}
			}
			if (cards.length) {
				return;
			}
			if (cards.length == 1) {
				trigger.cards.removeArray(event.cards[0]);
			} else {
				await player.chooseCardButton("藏机：请选择要防止弃置的牌", true, cards, 1).set("ai", () => {
					if (ui.selected.buttons.length == 0) {
						return 1;
					}
					return 0;
				});
			}
		},
	},
	qj_lieyong: {
		audio: "liegong",
		audioname2: { gz_jun_liubei: "shouyue_liegong" },
		locked: false,
		mod: {
			attackRange(player, distance) {
				let d = distance;
				if (player.isDamaged()) {
					d += player.loseHp();
				} else {
					d++;
				}
				if (get.zhu(player, "shouyue")) {
					return d + 1;
				}
				return d;
			},
		},
		trigger: { player: "useCardToPlayered" },
		filter(event, player) {
			return event.card.name == "sha" && (player.hp <= event.target.hp || player.countCards("h") < event.target.countCards("h"));
		},
		preHidden: true,
		async content(_event, trigger, player) {
			var str = get.translation(trigger.target),
				card = get.translation(trigger.card);
			let result = await player
				.chooseControl("cancel2")
				.set("choiceList", ["令" + card + "对" + str + "的伤害+1", "令" + str + "不能响应" + card])
				.set("prompt", get.prompt("gzliegong", trigger.target))
				.setHiddenSkill("gzliegong")
				.set("ai", function () {
					var player = _status.event.player,
						target = _status.event.getTrigger().target;
					if (get.attitude(player, target) > 0) {
						return 2;
					}
					return target.mayHaveShan(player, "use") ? 1 : 0;
				})
				.forResult();
			if (result.control != "cancel2") {
				var target = trigger.target;
				player.logSkill("gzliegong", target);
				if (result.index == 1) {
					game.log(trigger.card, "不可被", target, "响应");
					trigger.directHit.add(target);
				} else {
					game.log(trigger.card, "对", target, "的伤害+1");
					var map = trigger.getParent().customArgs,
						id = target.playerid;
					if (!map[id]) {
						map[id] = {};
					}
					if (!map[id].extraDamage) {
						map[id].extraDamage = 0;
					}
					map[id].extraDamage++;
				}
			}
		},
	},
	qj_kuanggu: {
		audio: "kuanggu",
		trigger: {
			source: "damageSource",
		},
		filter(event, _player) {
			// @ts-expect-error 类型系统未来可期
			return event.checkKuanggu && event.num > 0;
		},
		preHidden: true,
		async cost(event, _trigger, player) {
			let choice;
			if (
				player.isDamaged() &&
				get.recoverEffect(player) > 0 &&
				player.countCards("hs", function (card) {
					return card.name == "sha" && player.hasValueTarget(card);
				}) >= player.getCardUsable("sha", void 0)
			) {
				choice = "recover_hp";
			} else {
				choice = "draw_card";
			}
			const next = player.chooseDrawRecover("###" + get.prompt(event.skill) + "###摸一张牌或回复1点体力");
			next.set("choice", choice);
			next.set("ai", function () {
				// @ts-expect-error 类型系统未来可期
				return _status.event.getParent().choice;
			});
			next.set("logSkill", event.skill);
			next.setHiddenSkill(event.skill);
			const control = await next.forResultControl();
			if (control == "cancel2") {
				return;
			}
			if (player.getStorage("qj_kuanggu_effect") && !player.getStorage("qj_kuanggu_effect").includes(control)) {
				player.addTempSkill("qj_kuanggu_effect", {
					global: "phaseJieshuAfter",
				});
				player.addMark("qj_kuanggu_effect", 1, false);
			}
			player.unmarkAuto("qj_kuanggu_effect");
			player.markAuto("qj_kuanggu_effect", control);
			event.result = { bool: true, skill_popup: false };
		},
		async content(_event, _trigger, _player) {},
		subSkill: {
			effect: {
				mod: {
					cardUsable(card, player, num) {
						if (card.name == "sha") {
							return num + player.countMark("qj_kuanggu_effect");
						}
					},
				},
				charlotte: true,
				onremove: true,
				intro: {
					content: "使用【杀】的次数+#",
				},
			},
		},
	},
	qj_lianhuan: {
		audio: "lianhuan",
		hiddenCard(player, name) {
			return name == "tiesuo" && player.hasCard(card => get.suit(card) == "club", "sh");
		},
		enable: "chooseToUse",
		filter(event, player) {
			if (!player.hasCard(card => get.suit(card) == "club", "sh")) {
				return false;
			}
			return event.type == "phase" || event.filterCard(get.autoViewAs({ name: "tiesuo" }, "unsure"), player, event);
		},
		position: "hs",
		filterCard(card, player, event) {
			if (!event) {
				event = _status.event;
			}
			if (get.suit(card) != "club") {
				return false;
			}
			if (event.type == "phase" && get.position(card) != "s" && player.canRecast(card)) {
				return true;
			} else {
				if (game.checkMod(card, player, "unchanged", "cardEnabled2", player) === false) {
					return false;
				}
				const cardx = get.autoViewAs({ name: "tiesuo" }, [card]);
				return event._backup.filterCard(cardx, player, event);
			}
		},
		filterTarget(fuck, player, target) {
			const card = ui.selected.cards[0],
				event = _status.event,
				backup = event._backup;
			if (!card || game.checkMod(card, player, "unchanged", "cardEnabled2", player) === false) {
				return false;
			}
			const cardx = get.autoViewAs({ name: "tiesuo" }, [card]);
			return backup.filterCard(cardx, player, event) && backup.filterTarget(cardx, player, target);
		},
		selectTarget() {
			const card = ui.selected.cards[0],
				event = _status.event,
				player = event.player,
				backup = event._backup;
			let recast = false,
				use = false;
			const cardx = get.autoViewAs({ name: "tiesuo" }, [card]);
			if (event.type == "phase" && player.canRecast(card)) {
				recast = true;
			}
			if (card && game.checkMod(card, player, "unchanged", "cardEnabled2", player) !== false) {
				if (backup.filterCard(cardx, player, event)) {
					use = true;
				}
			}
			if (!use) {
				return [0, 0];
			} else {
				const select = backup.selectTarget(cardx, player);
				if (recast && select[0] > 0) {
					select[0] = 0;
				}
				return select;
			}
		},
		filterOk() {
			const card = ui.selected.cards[0],
				event = _status.event,
				player = event.player,
				backup = event._backup;
			const selected = ui.selected.targets.length;
			let recast = false,
				use = false;
			const cardx = get.autoViewAs({ name: "tiesuo" }, [card]);
			if (event.type == "phase" && player.canRecast(card)) {
				recast = true;
			}
			if (card && game.checkMod(card, player, "unchanged", "cardEnabled2", player) !== false) {
				if (backup.filterCard(cardx, player, event)) {
					use = true;
				}
			}
			if (recast && selected == 0) {
				return true;
			} else if (use) {
				const select = backup.selectTarget(cardx, player);
				if (select[0] <= -1) {
					return true;
				}
				return selected >= select[0] && selected <= select[1];
			}
		},
		ai1(card) {
			return 6 - get.value(card);
		},
		ai2(target) {
			const player = get.player();
			return get.effect(target, { name: "tiesuo" }, player, player);
		},
		discard: false,
		lose: false,
		delay: false,
		viewAs(cards, player) {
			return {
				name: "tiesuo",
			};
		},
		prepare: () => true,
		async precontent(event, trigger, player) {
			const result = event.result;
			if (!result?.targets?.length) {
				delete result.card;
			}
		},
		async content(event, trigger, player) {
			await player.recast(event.cards);
		},
		ai: {
			order(item, player) {
				if (game.hasPlayer(current => get.effect(current, { name: "tiesuo" }, player, player) > 0) || player.hasCard(card => get.suit(card) == "club" && player.canRecast(card), "h")) {
					return 8;
				}
				return 1;
			},
			result: { player: 1 },
		},
	},
	qj_niepan: {
		audio: "niepan",
		audioname: ["re_pangtong"],
		audioname2: { sb_pangtong: "sbniepan" },
		enable: "chooseToUse",
		limited: true,
		skillAnimation: true,
		animationColor: "fire",
		preHidden: true,
		filter(event, player) {
			if (event.type == "dying") {
				if (player != event.dying) {
					return false;
				}
				return true;
			} else if (event.getParent().name == "phaseUse") {
				return true;
			}
			return false;
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			player.storage.niepan = true;
			await player.discard(player.getCards("hej"));
			await player.link(false);
			await player.turnOver(false);
			await player.draw(3);
			if (player.hp < 3) {
				await player.recover(3 - player.hp);
			}
		},
		ai: {
			order: 0.5,
			skillTagFilter(player, tag, target) {
				if (player != target || player.storage.niepan) {
					return false;
				}
			},
			save: true,
			result: {
				player(player) {
					if (player.hp <= 0) {
						return 10;
					}
					if (player.hp <= 1 && player.countCards("he") <= 1) {
						return 10;
					}
					return 0;
				},
			},
			threaten(player, target) {
				if (!target.storage.niepan) {
					return 0.6;
				}
			},
		},
	},
	qj_huoji: {
		audio: "huoji",
		enable: "chooseToUse",
		filterCard(card) {
			return get.color(card) == "red";
		},
		viewAs: { name: "huogong" },
		viewAsFilter(player) {
			if (!player.countCards("hs", { color: "red" })) {
				return false;
			}
		},
		position: "hs",
		prompt: "将一张红色牌当火攻使用",
		check(card) {
			const player = get.player();
			if (player.countCards("h") > player.hp) {
				return 6 - get.value(card);
			}
			return 3 - get.value(card);
		},
		ai: {
			fireAttack: true,
		},
	},
	qj_bazhen: {
		audio: "bazhen",
		group: "qj_bazhen_bagua",
		locked: true,
		subSkill: {
			bagua: {
				audio: "bazhen",
				equipSkill: true,
				noHidden: true,
				inherit: "bagua_skill",
				sourceSkill: "bazhen",
				filter(event, player) {
					if (!lib.skill.bagua_skill.filter(event, player)) {
						return false;
					}
					if (!player.hasEmptySlot(2)) {
						return false;
					}
					return true;
				},
				ai: {
					respondShan: true,
					freeShan: true,
					skillTagFilter(player, tag, arg) {
						if (tag !== "respondShan" && tag !== "freeShan") {
							return;
						}
						if (!player.hasEmptySlot(2) || player.hasSkillTag("unequip2")) {
							return false;
						}
						if (!arg || !arg.player) {
							return true;
						}
						if (
							arg.player.hasSkillTag("unequip", false, {
								target: player,
							})
						) {
							return false;
						}
						return true;
					},
					effect: {
						target(card, player, target) {
							if (player == target && get.subtype(card) == "equip2") {
								if (get.equipValue(card) <= 7.5) {
									return 0;
								}
							}
							if (!target.hasEmptySlot(2)) {
								return;
							}
							return lib.skill.bagua_skill.ai.effect.target.apply(this, arguments);
						},
					},
				},
			},
		},
	},
	qj_kanpo: {
		mod: {
			aiValue(player, card, num) {
				if (get.name(card) != "wuxie" && get.color(card) != "black") {
					return;
				}
				const cards = player.getCards("hs", function (card) {
					return get.name(card) == "wuxie" || get.color(card) == "black";
				});
				cards.sort(function (a, b) {
					return (get.name(b) == "wuxie" ? 1 : 2) - (get.name(a) == "wuxie" ? 1 : 2);
				});
				const geti = function () {
					if (cards.includes(card)) {
						return cards.indexOf(card);
					}
					return cards.length;
				};
				if (get.name(card) == "wuxie") {
					return Math.min(num, [6, 4, 3][Math.min(geti(), 2)]) * 0.6;
				}
				return Math.max(num, [6, 4, 3][Math.min(geti(), 2)]);
			},
			aiUseful() {
				return lib.skill.kanpo.mod.aiValue.apply(this, arguments);
			},
		},
		locked: false,
		audio: "kanpo",
		enable: "chooseToUse",
		group: "kanpo_respond",
		filterCard(card) {
			return get.color(card) == "black";
		},
		viewAsFilter(player) {
			return player.countCards("hs", { color: "black" }) > 0;
		},
		viewAs: { name: "wuxie" },
		position: "hs",
		prompt: "将一张黑色手牌当无懈可击使用",
		check(card) {
			const tri = _status.event.getTrigger();
			if (tri && tri.card && tri.card.name == "chiling") {
				return -1;
			}
			return 8 - get.value(card);
		},
		threaten: 1.2,
		subSkill: {
			respond: {
				trigger: {
					target: "shaMiss",
					global: "eventNeutralized",
				},
				filter(event, player, name) {
					if (event.type != "card") {
						return false;
					}
					return name == "shaMiss" || event._neutralize_event.player == player;
				},
				forced: true,
				async content(event, trigger, player) {
					if (!player.hasSkill("qj_kanpo_view")) {
						player.addTempSkill("qj_kanpo_view", "phaseAfter");
					}
				},
			},
			view: {
				trigger: {
					global: "phaseEnd",
				},
				filter(event, player) {
					return event.player.countCards("h") > 0;
				},
				async content(event, trigger, player) {
					await player.viewHandcards(trigger.player);
				},
			},
		},
	},
	qj_xiangle: {
		audio: "xiangle",
		audioname: ["re_liushan", "ol_liushan"],
		trigger: { target: "useCardToTargeted" },
		forced: true,
		preHidden: true,
		filter(event, player) {
			return event.card.name == "sha";
		},
		async content(event, trigger, player) {
			const eff = get.effect(player, trigger.card, trigger.player, trigger.player);
			const { result } = await trigger.player
				.chooseToDiscard("享乐：弃置一张基本牌，否则杀对" + get.translation(player) + "无效", function (card) {
					return get.type(card) == "basic";
				})
				.set("ai", function (card) {
					if (_status.event.eff > 0) {
						return 10 - get.value(card);
					}
					return 0;
				})
				.set("eff", eff);
			if (!result?.bool) {
				trigger.getParent().excluded.add(player);
			}
		},
		ai: {
			effect: {
				target(card, player, target, current) {
					if (card.name == "sha" && get.attitude(player, target) < 0) {
						if (_status.event.name == "xiangle") {
							return;
						}
						if (get.attitude(player, target) > 0 && current < 0) {
							return "zerotarget";
						}
						const bs = player.getCards("h", { type: "basic" });
						bs.remove(card);
						if (card.cards) {
							bs.removeArray(card.cards);
						} else {
							bs.removeArray(ui.selected.cards);
						}
						if (!bs.length) {
							return "zerotarget";
						}
						if (player.hasSkill("jiu") || player.hasSkill("tianxianjiu")) {
							return;
						}
						if (bs.length <= 2) {
							for (let i = 0; i < bs.length; i++) {
								if (get.value(bs[i]) < 7) {
									return [1, 0, 1, -0.5];
								}
							}
							return [1, 0, 0.3, 0];
						}
						return [1, 0, 1, -0.5];
					}
				},
			},
		},
	},
	qj_fangquan: {
		audio: "fangquan",
		trigger: { player: "phaseUseBefore" },
		round: 1,
		filter(event, player) {
			return player.countCards("h") > 0 && !player.hasSkill("fangquan3");
		},
		preHidden: true,
		async cost(event, trigger, player) {
			const fang = player.countMark("fangquan2") == 0 && player.hp >= 2 && player.countCards("h") <= player.hp + 1;
			event.result = await player
				.chooseBool(get.prompt2(event.skill))
				.set("ai", function () {
					const player = get.player();
					if (!_status.event.fang) {
						return false;
					}
					return game.hasPlayer(function (target) {
						if (target.hasJudge("lebu") || target == player) {
							return false;
						}
						if (get.attitude(player, target) > 4) {
							return get.threaten(target) / Math.sqrt(target.hp + 1) / Math.sqrt(target.countCards("h") + 1) > 0;
						}
						return false;
					});
				})
				.set("fang", fang)
				.setHiddenSkill(event.name.slice(0, -5))
				.forResult();
		},
		async content(event, trigger, player) {
			trigger.cancel();
			player.addTempSkill("fangquan2");
			player.addMark("fangquan2", 1, false);
			//player.storage.fangquan=result.targets[0];
		},
	},
	qj_huoshou: {
		audio: "huoshou1",
		locked: true,
		group: ["qj_huoshou_1", "qj_huoshou_2"],
		preHidden: ["qj_huoshou_1", "qj_huoshou_2"],
		ai: {
			halfneg: true,
			effect: {
				target(card, player, target) {
					if (card.name == "nanman") {
						return "zeroplayertarget";
					}
				},
			},
		},
		subSkill: {
			1: {
				audio: "huoshou1",
				trigger: { target: "useCardToBefore" },
				forced: true,
				priority: 15,
				sourceSkill: "qj_huoshou",
				filter(event, player) {
					return event.card.name == "nanman";
				},
				async content(event, trigger, player) {
					trigger.cancel();
				},
			},
			2: {
				audio: "huoshou1",
				trigger: { global: "useCard" },
				forced: true,
				sourceSkill: "qj_huoshou",
				filter(event, player) {
					return event.card && event.card.name == "nanman" && event.player != player;
				},
				async content(event, trigger, player) {
					trigger.customArgs.default.customSource = player;
				},
			},
		},
	},
	qj_zaiqi: {
		audio: "zaiqi",
		preHidden: true,
		filter(event, player) {
			return lib.skill.qj_zaiqi.count() > 0;
		},
		trigger: {
			player: "phaseDiscardAfter",
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget([1, lib.skill.qj_zaiqi.count()], get.prompt2("qj_zaiqi"))
				.set("ai", function (target) {
					return get.attitude(_status.event.player, target);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			var targets = event.targets;
			await targets.sortBySeat();
			player.line(targets, "fire");
			player.logSkill("qj_zaiqi", targets);
			event.targets = targets;
			for (let target of event.targets) {
				if (player.isHealthy()) {
					event.result = { index: 0 };
				} else {
					event.result = await target
						.chooseControl()
						.set("choiceList", ["摸一张牌", "令" + get.translation(player) + "回复1点体力"])
						.set("ai", function () {
							if (get.attitude(target, player) > 0) {
								return 1;
							}
							return 0;
						})
						.forResult();
				}
				if (event.result.index == 1) {
					await target.line(player);
					await player.recover(target);
				} else {
					await target.draw();
				}
				game.delay();
			}
		},
		count: () => get.discarded().filter(card => get.color(card) === "red").length,
	},
	qj_juxiang: {
		//unique:true,
		locked: true,
		audio: "juxiang1",
		group: ["qj_juxiang_1", "qj_juxiang_2"],
		preHidden: ["qj_juxiang_1", "qj_juxiang_2"],
		ai: {
			effect: {
				target(card) {
					if (card.name == "nanman") {
						return [0, 1, 0, 0];
					}
				},
			},
		},
		subSkill: {
			1: {
				audio: "juxiang1",
				audioname: ["re_zhurong", "ol_zhurong"],
				trigger: { target: "useCardToBefore" },
				forced: true,
				priority: 15,
				sourceSkill: "juxiang",
				filter(event, player) {
					return event.card.name == "nanman";
				},
				async content(event, trigger, player) {
					trigger.cancel();
				},
			},
			2: {
				audio: "juxiang1",
				audioname: ["re_zhurong", "ol_zhurong"],
				trigger: { global: "useCardAfter" },
				forced: true,
				sourceSkill: "juxiang",
				filter(event, player) {
					return event.card.name == "nanman" && event.player != player && event.cards.someInD();
				},
				async content(event, trigger, player) {
					await player.gain(trigger.cards.filterInD(), "gain2");
				},
			},
		},
	},
	qj_lieren: {
		audio: "lieren",
		preHidden: true,
		trigger: { source: "damageSource" },
		filter(event, player) {
			if (event._notrigger.includes(event.player)) {
				return false;
			}
			return event.card && event.card.name == "sha" && event.getParent().name == "sha" && event.player.isIn() && player.canCompare(event.player);
		},
		check(event, player) {
			return get.attitude(player, event.player) < 0 && player.countCards("h") > 1;
		},
		//priority:5,
		async content(event, trigger, player) {
			const { result } = await player.chooseToCompare(trigger.player);
			if (result.bool && trigger.player.countGainableCards(player, "he")) {
				await player.gainPlayerCard(trigger.player, true, "he");
			}
		},
	},
	qj_shushen: {
		audio: "shushen",
		preHidden: true,
		trigger: { player: "recoverEnd" },
		filter(event, player) {
			return game.hasPlayer(current => current != player) && event.num > 0;
		},
		getIndex: event => event.num,
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), lib.filter.notMe)
				.set("ai", target => {
					const player = get.player();
					return get.recoverEffect(target, player, player) / 2 + get.attitude(player, target);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			let result;
			if (target.isDamaged()) {
				result = await player
					.chooseControl("选项一", "选项二")
					.set("choiceList", [`令${get.translation(target)}回复1点体力`, `你与${get.translation(target)}各摸一张牌`])
					.set("prompt", "淑慎：请选择一项")
					.set("ai", () => {
						return get.event("choice");
					})
					.set(
						"choice",
						(() => {
							if (target.hp <= 2 || get.recoverEffect(target, player, player) > 20) {
								return "选项一";
							}
							return "选项二";
						})()
					)
					.forResult();
			} else {
				result = { control: "选项二" };
			}
			if (result?.control == "选项一") {
				await target.recover();
			} else if (result?.control == "选项二") {
				const drawers = [player, target].sortBySeat(_status.currentPhase);
				await game.asyncDraw(drawers);
			}
		},
	},
	qj_shenzhi: {
		audio: "shenzhi",
		trigger: { player: "phaseZhunbeiBegin" },
		check(event, player) {
			if (player.hp > 2) {
				return false;
			}
			var cards = player.getCards("h");
			if (cards.length < player.hp) {
				return false;
			}
			if (cards.length > 3) {
				return false;
			}
			for (var i = 0; i < cards.length; i++) {
				if (get.value(cards[i]) > 7 || get.tag(cards[i], "recover") >= 1) {
					return false;
				}
			}
			return true;
		},
		filter(event, player) {
			return player.countCards("h") > 0;
		},
		preHidden: true,
		async content(event, trigger, player) {
			var cards = player.getCards("h");
			event.bool = cards.length >= player.hp;
			await player.discard(cards);
			if (event.bool) {
				await player.recover();
			}
		},
	},
	qj_zhiheng: {
		audio: "zhiheng",
		audioname: ["gz_jun_sunquan"],
		audioname2: {
			xin_simayi: "jilue_zhiheng",
		},
		mod: {
			aiOrder(player, card, num) {
				if (num <= 0 || get.itemtype(card) !== "card" || get.type(card) !== "equip") {
					return num;
				}
				let eq = player.getEquip(get.subtype(card));
				if (eq && get.equipValue(card) - get.equipValue(eq) < Math.max(1.2, 6 - player.hp)) {
					return 0;
				}
			},
		},
		locked: false,
		enable: "phaseUse",
		usable: 1,
		position: "he",
		allowChooseAll: true,
		selectCard() {
			const player = get.player();
			const range1 = [1, player.maxHp];
			if (player.hasSkill("dinglanyemingzhu_skill")) {
				for (let i = 0; i < ui.selected.cards.length; i++) {
					if (ui.selected.cards[i] == player.getEquip("dinglanyemingzhu")) {
						return range1;
					}
				}
				return [1, Infinity];
			}
			return range1;
		},
		filterCard(card, player) {
			if (ui.selected.cards.length < player.maxHp || !player.hasSkill("dinglanyemingzhu_skill")) {
				return true;
			}
			return card != player.getEquip("dinglanyemingzhu");
		},
		complexCard: true,
		complexSelect: true,
		prompt() {
			const player = get.player();
			if (player.hasSkill("dinglanyemingzhu_skill")) {
				return "出牌阶段限一次，你可以弃置任意张牌并摸等量的牌";
			}
			return "出牌阶段限一次，你可以弃置至多X张牌并摸等量的牌（X为你的体力上限）。";
		},
		async content(event, trigger, player) {
			player.draw(event.cards.length);
		},
		ai: {
			order: 1,
			result: {
				player: 1,
			},
			threaten: 1.5,
		},
	},
	qj_qixi: {
		audio: "qixi",
		audioname: ["re_ganning"],
		audioname2: { re_heqi: "duanbing_heqi" },
		enable: "chooseToUse",
		filterCard(card) {
			return get.color(card) == "black";
		},
		position: "hes",
		viewAs: { name: "guohe" },
		viewAsFilter(player) {
			if (!player.countCards("hes", { color: "black" })) {
				return false;
			}
		},
		prompt: "将一张黑色牌当过河拆桥使用",
		check(card) {
			return 4 - get.value(card);
		},
	},
	qj_keji: {
		audio: "keji",
		forced: true,
		trigger: {
			player: "phaseDiscardBegin",
		},
		filter(event, player) {
			const list = [];
			player.getHistory("useCard", function (evt) {
				if (evt.isPhaseUsing(player)) {
					const color = get.color(evt.card);
					if (color != "nocolor") {
						list.add(color);
					}
				}
				return true;
			});
			return list.length <= 1;
		},
		check(event, player) {
			return player.needsToDiscard();
		},
		async content(event, trigger, player) {
			player.addTempSkill("keji_add", "phaseAfter");
		},
	},
	qj_mouduan: {
		trigger: {
			player: "phaseJieshuBegin",
		},
		//priority:2,
		audio: "botu",
		filter(event, player) {
			const history = player.getHistory("useCard");
			const suits = [];
			const types = [];
			for (let i = 0; i < history.length; i++) {
				const suit = get.suit(history[i].card);
				if (suit) {
					suits.add(suit);
				}
				types.add(get.type(history[i].card));
			}
			const suitsConditionMet = suits.length >= 4;
			const typesConditionMet = types.length >= 3;
			return suitsConditionMet || typesConditionMet;
		},
		check(event, player) {
			return player.canMoveCard(true, void 0);
		},
		async content(event, trigger, player) {
			const history = player.getHistory("useCard");
			const suits = [];
			const types = [];
			for (let i = 0; i < history.length; i++) {
				const suit = get.suit(history[i].card);
				if (suit) {
					suits.add(suit);
				}
				types.add(get.type(history[i].card));
			}
			const suitsConditionMet = suits.length >= 4;
			const typesConditionMet = types.length >= 3;
			const bothConditionsMet = suitsConditionMet && typesConditionMet;

			await player.moveCard();

			if (bothConditionsMet && !player.hasSkill("qj_shelie")) {
				player.addSkills("qj_shelie");
			}
		},
		// TODO: 补充 ai（让ai更倾向于使用未使用过的花色）
	},
	qj_shelie: {
		audio: "shelie",
		trigger: { player: "phaseDrawBegin1" },
		filter(event, player) {
			return !event.numFixed;
		},
		content() {
			"step 0";
			trigger.changeToZero();
			event.cards = get.cards(5);
			game.cardsGotoOrdering(event.cards);
			event.videoId = lib.status.videoId++;
			game.broadcastAll(
				function (player, id, cards) {
					var str;
					if (player == game.me && !_status.auto) {
						str = "涉猎：获取花色各不相同的牌";
					} else {
						str = "涉猎";
					}
					var dialog = ui.create.dialog(str, cards);
					dialog.videoId = id;
				},
				player,
				event.videoId,
				event.cards
			);
			event.time = get.utc();
			game.addVideo("showCards", player, ["涉猎", get.cardsInfo(event.cards)]);
			game.addVideo("delay", null, 2);
			("step 1");
			var list = [];
			for (var i of cards) {
				list.add(get.suit(i, false));
			}
			var next = player.chooseButton(list.length, true);
			next.set("dialog", event.videoId);
			next.set("filterButton", function (button) {
				for (var i = 0; i < ui.selected.buttons.length; i++) {
					if (get.suit(ui.selected.buttons[i].link) == get.suit(button.link)) {
						return false;
					}
				}
				return true;
			});
			next.set("ai", function (button) {
				return get.value(button.link, _status.event.player);
			});
			("step 2");
			if (result.bool && result.links) {
				event.cards2 = result.links;
			} else {
				event.finish();
			}
			var time = 1000 - (get.utc() - event.time);
			if (time > 0) {
				game.delay(0, time);
			}
			("step 3");
			game.broadcastAll("closeDialog", event.videoId);
			var cards2 = event.cards2;
			player.gain(cards2, "log", "gain2");
		},
		ai: {
			threaten: 1.2,
		},
	},
	qj_kurou: {
		audio: "rekurou",
		enable: "phaseUse",
		usable: 1,
		filterCard: lib.filter.cardDiscardable,
		check(card) {
			return 8 - get.value(card);
		},
		position: "he",
		content() {
			player.loseHp();
		},
		ai: {
			order: 8,
			result: {
				player(player) {
					if (player.needsToDiscard(3) && !player.hasValueTarget({ name: "sha" }, false)) {
						return -1;
					}
					return get.effect(player, { name: "losehp" }, player, player);
				},
			},
			neg: true,
		},
	},
	qj_zhaxiang: {
		audio: "zhaxiang",
		trigger: { player: "loseHpEnd" },
		filter(event, player) {
			return player.isIn() && event.num > 0;
		},
		forced: true,
		async content(event, trigger, player) {
			await player.draw(3);
			player.addTempSkill(event.name + "_effect", {
				global: "phaseJieshuAfter",
			});
			player.addMark(event.name + "_effect", 1, false);
		},
		subSkill: {
			effect: {
				mod: {
					targetInRange(card, player, target, now) {
						if (card.name == "sha" && get.color(card) == "red") {
							return true;
						}
					},
					cardUsable(card, player, num) {
						if (card.name == "sha") {
							return num + player.countMark("qj_zhaxiang_effect");
						}
					},
				},
				charlotte: true,
				onremove: true,
				audio: "zhaxiang",
				audioname2: { ol_sb_jiangwei: "zhaxiang_ol_sb_jiangwei" },
				intro: {
					content: "<li>使用红色【杀】无距离限制<br><li>使用【杀】的次数+#",
				},
			},
		},
		ai: {
			maihp: true,
			effect: {
				target(card, player, target) {
					if (get.tag(card, "damage")) {
						if (player.hasSkillTag("jueqing", false, target)) {
							return [1, 1];
						}
						return 1.2;
					}
					if (get.tag(card, "loseHp")) {
						if (target.hp <= 1) {
							return;
						}
						var using = target.isPhaseUsing();
						if (target.hp <= 2) {
							return [1, player.countCards("h") <= 1 && using ? 3 : 0];
						}
						if (
							using &&
							target.countCards("h", {
								name: "sha",
								color: "red",
							})
						) {
							return [1, 3];
						}
						return [1, target.countCards("h") <= target.hp || (using && game.hasPlayer(current => current != player && get.attitude(player, current) < 0 && player.inRange(current))) ? 3 : 2];
					}
				},
			},
		},
	},
	qj_yingzi: {
		audio: "yingzi",
		audioname: ["sunce"],
		trigger: { player: "phaseDrawBegin2" },
		forced: true,
		preHidden: true,
		filter(event, player) {
			return !event.numFixed;
		},
		content() {
			trigger.num++;
		},
		ai: {
			threaten: 1.5,
		},
		mod: {
			maxHandcardBase(player, num) {
				return player.maxHp;
			},
		},
	},
	qj_fanjian: {
		audio: "fanjian",
		mainSkill: true,
		init(player) {
			const playerRef = cast(player);
			if (playerRef.checkMainSkill("qj_fanjian")) {
				playerRef.removeMaxHp();
			}
		},
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.countCards("h") > 0;
		},
		filterTarget(card, player, target) {
			return player != target;
		},
		filterCard: true,
		check(card) {
			return 8 - get.value(card);
		},
		discard: false,
		lose: false,
		delay: false,
		content() {
			"step 0";
			target.storage.refanjian = cards[0];
			player.give(cards[0], target);
			("step 1");
			var suit = get.suit(target.storage.refanjian);
			if (!target.countCards("h")) {
				event._result = { control: "refanjian_hp" };
			} else {
				target.chooseControl("refanjian_card", "refanjian_hp").ai = function (event, player) {
					var cards = player.getCards("he", {
						suit: get.suit(player.storage.refanjian),
					});
					if (cards.length == 1) {
						return 0;
					}
					if (cards.length >= 2) {
						for (var i = 0; i < cards.length; i++) {
							if (get.tag(cards[i], "save")) {
								return 1;
							}
						}
					}
					if (player.hp == 1) {
						return 0;
					}
					for (var i = 0; i < cards.length; i++) {
						if (get.value(cards[i]) >= 8) {
							return 1;
						}
					}
					if (cards.length > 2 && player.hp > 2) {
						return 1;
					}
					if (cards.length > 3) {
						return 1;
					}
					return 0;
				};
			}
			("step 2");
			if (result.control == "refanjian_card") {
				target.showHandcards();
			} else {
				target.loseHp();
				event.finish();
			}
			("step 3");
			var suit = get.suit(target.storage.refanjian);
			target.discard(
				target.getCards("he", function (i) {
					return get.suit(i) == suit && lib.filter.cardDiscardable(i, target, "refanjian");
				})
			);
			delete target.storage.refanjian;
		},
		ai: {
			order: 9,
			result: {
				target(player, target) {
					return -target.countCards("he") - (player.countCards("h", "du") ? 1 : 0);
				},
			},
			threaten: 2,
		},
	},
	qj_guose: {
		audio: "guose",
		enable: "phaseUse",
		usable: 1,
		discard: false,
		lose: false,
		delay: false,
		filter(event, player) {
			return player.countCards("hes", { suit: "diamond" }) > 0;
		},
		position: "hes",
		filterCard: { suit: "diamond" },
		filterTarget(card, player, target) {
			if (get.position(ui.selected.cards[0]) != "s" && lib.filter.cardDiscardable(ui.selected.cards[0], player, "reguose") && target.hasJudge("lebu")) {
				return true;
			}
			if (player == target) {
				return false;
			}
			if (!game.checkMod(ui.selected.cards[0], player, "unchanged", "cardEnabled2", player)) {
				return false;
			}
			return player.canUse({ name: "lebu", cards: ui.selected.cards }, target);
		},
		check(card) {
			return 7 - get.value(card);
		},
		content() {
			if (target.hasJudge("lebu")) {
				player.discard(cards);
				target.discard(target.getJudge("lebu"));
			} else {
				player.useCard({ name: "lebu" }, target, cards).audio = false;
			}
			player.draw();
		},
		ai: {
			result: {
				target(player, target) {
					if (target.hasJudge("lebu")) {
						return -get.effect(target, { name: "lebu" }, player, target);
					}
					return get.effect(target, { name: "lebu" }, player, target);
				},
			},
			order: 9,
		},
	},
	qj_liuli: {
		audio: "liuli",
		trigger: { target: "useCardToTarget" },
		preHidden: true,
		filter(event, player) {
			if (event.card.name != "sha") {
				return false;
			}
			if (player.countCards("he") == 0) {
				return false;
			}
			return game.hasPlayer(current => {
				return player.inRange(current) && current != event.player && current != player && lib.filter.targetEnabled(event.card, event.player, current);
			});
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCardTarget({
					position: "he",
					filterCard: lib.filter.cardDiscardable,
					filterTarget: (card, player, target) => {
						const trigger = _status.event;
						if (player.inRange(target) && target != trigger.source) {
							if (lib.filter.targetEnabled(trigger.card, trigger.source, target)) {
								return true;
							}
						}
						return false;
					},
					ai1: card => get.unuseful(card) + 9,
					ai2: target => {
						const player = get.player();
						if (player.countCards("h", "shan")) {
							return -get.attitude(player, target);
						}
						if (get.attitude(player, target) < 5) {
							return 6 - get.attitude(player, target);
						}
						if (player.hp == 1 && player.countCards("h", "shan") == 0) {
							return 10 - get.attitude(player, target);
						}
						if (player.hp == 2 && player.countCards("h", "shan") == 0) {
							return 8 - get.attitude(player, target);
						}
						return -1;
					},
					prompt: get.prompt(event.skill),
					prompt2: "弃置一张牌，将此【杀】转移给攻击范围内的一名其他角色",
					source: trigger.player,
					card: trigger.card,
				})
				.setHiddenSkill(event.name.slice(0, -5))
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			player.discard(event.cards);
			const evt = trigger.getParent();
			evt.triggeredTargets2.remove(player);
			evt.targets.remove(player);
			evt.targets.push(target);
		},
		ai: {
			effect: {
				target_use(card, player, target) {
					if (target.countCards("he") == 0) {
						return;
					}
					if (card.name != "sha") {
						return;
					}
					let min = 1;
					const friend = get.attitude(player, target) > 0;
					const vcard = {
						name: "shacopy",
						nature: card.nature,
						suit: card.suit,
					};
					const players = game.filterPlayer();
					for (let i = 0; i < players.length; i++) {
						if (player != players[i] && get.attitude(target, players[i]) < 0 && target.canUse(card, players[i])) {
							if (!friend) {
								return 0;
							}
							if (get.effect(players[i], vcard, player, player) > 0) {
								if (!player.canUse(card, players[0])) {
									return [0, 0.1];
								}
								min = 0;
							}
						}
					}
					return min;
				},
			},
		},
	},
	qj_qianxun: {
		// TODO: 待测试
		audio: "qianxun",
		trigger: {
			target: "useCardToTarget",
			player: "addJudgeBefore",
		},
		forced: true,
		preHidden: true,
		priority: 15,
		filter(event, player) {
			// 条件1: 这张牌是锦囊牌
			if (get.type(event.card) != "trick") {
				return false;
			}

			// 条件2: 这是当前回合下第一次成为锦囊牌的目标
			if (player.hasSkill("qj_qianxun_triggered")) {
				return false; // 本回合已经触发过
			}

			// 条件3: 这张牌选择的目标中，有其他能成为目标但未被选择为目标的角色
			const useCardEvent = event.getParent("useCard");
			if (!useCardEvent || !useCardEvent.targets) {
				return false;
			}
			const card = event.card;

			// 检查是否有其他合法目标未被选择
			const allPlayers = game.players.slice();
			if (useCardEvent.deadTarget || (card && get.info(card)?.deadTarget)) {
				allPlayers.addArray(game.dead);
			}

			for (const target of allPlayers) {
				// 如果这个目标已经在选择列表中，跳过
				if (useCardEvent.targets.includes(target)) {
					continue;
				}
				// 检查这个目标是否可以成为合法目标
				if (lib.filter.targetEnabled2(card, event.player, target)) {
					player.addTempSkill("qj_qianxun_triggered");
					return true; // 找到了其他合法目标
				}
			}

			return false; // 没有其他合法目标
		},
		async content(event, trigger, player) {
			if (trigger.name == "addJudge") {
				trigger.cancel(undefined, undefined, undefined);
				const owner = get.owner(trigger.card);
				if (owner && owner.getCards("hej").includes(trigger.card)) {
					owner.lose(trigger.card, ui.discardPile);
				} else {
					game.cardsDiscard(trigger.card);
				}
				game.log(trigger.card, "进入了弃牌堆");
			} else {
				// 标记本回合已触发
				trigger.getParent()?.targets?.remove(player);
			}
		},
		ai: {
			effect: {
				target(card, player, target, current) {
					if (get.type(card, "trick") == "trick" && !player.hasSkill("qj_qianxun_triggered")) {
						if (game.hasPlayer(p => p != player && lib.filter.targetEnabled2(card, current, p))) {
							return "zeroplayertarget"; // 找到了其他合法目标
						}
					}
				},
			},
		},
		subSkill: {
			triggered: {
				charlotte: true,
				onremove: true,
			},
		},
	},
	qj_duoshi: {
		audio: "duoshi",
		enable: "chooseToUse",
		position: "he",
		group: ["qj_duoshi_checkAfter"],
		viewAs: { name: "yiyi" },
		// 计算并更新已进入弃牌堆的花色至玩家storage
		getDiscardedSuits(player) {
			if (!player) return [];
			const allowedSuits = ["spade", "heart", "diamond", "club"];
			const discardedCards = get.discarded();
			const discardedSuits = [];
			for (const discardedCard of discardedCards) {
				const suit = get.suit(discardedCard);
				if (allowedSuits.includes(suit) && !discardedSuits.includes(suit)) {
					discardedSuits.push(suit);
				}
			}
			player.storage.qj_duoshi_discardedSuits = discardedSuits.slice(0);
			return discardedSuits;
		},
		getAvailableSuits(player) {
			if (!player) return [];
			const discardedSuits = lib.skill.qj_duoshi.getDiscardedSuits(player);
			const allSuits = ["spade", "heart", "diamond", "club"];
			return allSuits.filter(suit => !discardedSuits.includes(suit));
		},
		// 你可以将本回合未置入过弃牌堆的花色的一张牌当【以逸待劳】使用
		viewAsFilter(player) {
			const availableSuits = lib.skill.qj_duoshi.getAvailableSuits(player);
			if (availableSuits.length === 0) {
				return false;
			}
			return player.hasCard(card => {
				const suit = get.suit(card, player);
				return availableSuits.includes(suit);
			}, "he");
		},
		filterCard(card, player) {
			const cardSuit = get.suit(card, player);
			const availableSuits = lib.skill.qj_duoshi.getAvailableSuits(player);
			return availableSuits.includes(cardSuit);
		},
		prompt(event) {
			const availableSuits = lib.skill.qj_duoshi.getAvailableSuits(event?.player);

			if (!availableSuits || availableSuits.length === 0) {
				return "将一张本回合未置入过弃牌堆的花色的牌当【以逸待劳】使用";
			}
			const availableSuitsText = availableSuits.map(suit => get.translation(suit)).join("/");
			return `将一张${availableSuitsText}的牌当【以逸待劳】使用`;
		},
		check(card) {
			return 4 - get.value(card);
		},
		subSkill: {
			checkAfter: {
				trigger: { player: "useCardAfter" },
				forced: true,
				popup: false,
				charlotte: true,
				filter(event, player) {
					return event.card && event.skill == "qj_duoshi";
				},
				async content(event, trigger, player) {
					let suits = lib.skill.qj_duoshi.getDiscardedSuits(player);
					if (["spade", "heart", "diamond", "club"].includes(get.suit(trigger.card)) && !suits.includes(get.suit(trigger.card))) {
						suits.push(get.suit(trigger.card));
					}
					if (suits.length == 4) {
						const result = await player
							.chooseTarget("你可以令一名小势力角色选择是否将X张红色牌当【火烧连营】使用（X为目标数）。", function (card, player, target) {
								return (
									target.isMinor() &&
									target.countCards("h", card => {
										if (!target.hasUseTarget(get.autoViewAs({ name: "huoshaolianying" }, [card]))) {
											return false;
										}
										return target != player || game.checkMod(card, player, "unchanged", "cardEnabled2", player);
									}) >= 1
								);
							})
							.set("ai", target => {
								return target.getUseValue({ name: "huoshaolianying" });
							})
							.forResult();
						if (result.bool) {
							player.line(result.targets[0]);
							await result.targets[0]
								.chooseToUse()
								.set("openskilldialog", "度势：是否将X张红色牌当【火烧连营】使用（X为目标数）。")
								.set("norestore", true)
								.set("_backupevent", "qj_duoshi_backup")
								.set("custom", {
									add: {},
									replace: { window() {} },
								})
								.set("addCount", false)
								.set("oncard", () => _status.event.directHit.addArray(game.players))
								.backup("qj_duoshi_backup");
						}
					}
				},
			},
			backup: {
				selectCard: [1, Infinity],
				filterOk() {
					let targets = ui.selected.targets;
					let targetsNum = game.countPlayer(function (current) {
						for (let i of targets) {
							if (i == current || i.inline(current)) {
								return true;
							}
						}
						return false;
					});
					return ui.selected.cards.length == targetsNum;
				},
				filterCard(card) {
					return get.itemtype(card) == "card" && get.color(card) == "red";
				},
				position: "hs",
				check(card) {
					return 7 - get.value(card);
				},
				log: false,
				viewAs: { name: "huoshaolianying" },
			},
		},
		init(player) {
			player.storage.qj_duoshi_discardedSuits = [];
		},
		onremove(player) {
			delete player.storage.qj_duoshi_discardedSuits;
		},
	},
	qj_jieyin: {
		audio: "jieyin",
		enable: "phaseUse",
		filterCard: true,
		usable: 1,
		position: "he",
		filter(event, player) {
			return player.countCards("he") > 0 && game.hasPlayer(c => c.hasSex("male") && c.isIn() && c != player);
		},
		check(card) {
			var player = _status.event.player;
			if (get.position(card) == "e") {
				var subtype = get.subtype(card);
				if (
					!game.hasPlayer(function (current) {
						return current != player && get.attitude(player, current) > 0 && !current.countCards("e", { subtype: subtype });
					})
				) {
					return 0;
				}
				if (player.countCards("h", { subtype: subtype })) {
					return 20 - get.value(card);
				}
				return 10 - get.value(card);
			} else {
				if (player.countCards("e")) {
					return 0;
				}
				if (player.countCards("h", { type: "equip" })) {
					return 0;
				}
				return 8 - get.value(card);
			}
		},
		filterTarget(card, player, target) {
			if (!target.hasSex("male")) {
				return false;
			}
			var card = ui.selected.cards[0];
			if (!card) {
				return false;
			}
			if (get.position(card) == "e" && !target.canEquip(card)) {
				return false;
			}
			return true;
		},
		discard: false,
		delay: false,
		lose: false,
		content() {
			"step 0";
			if (get.position(cards[0]) == "e") {
				event._result = { index: 0 };
			} else if (get.type(cards[0]) != "equip" || !target.canEquip(cards[0])) {
				event._result = { index: 1 };
			} else {
				player.chooseControl().set("choiceList", ["将" + get.translation(cards[0]) + "置入" + get.translation(target) + "的装备区", "弃置" + get.translation(cards[0])]).ai = function () {
					return 1;
				};
			}
			("step 1");
			if (result.index == 0) {
				player.$give(cards, target, false);
				target.equip(cards[0]);
			} else {
				player.discard(cards);
			}
			("step 2");
			if (player.hp > target.hp) {
				player.draw();
				if (target.isDamaged()) {
					target.recover();
				}
			} else if (player.hp < target.hp) {
				target.draw();
				if (player.isDamaged()) {
					player.recover();
				}
			}
		},
		ai: {
			order() {
				var player = _status.event.player;
				var es = player.getCards("e");
				for (var i = 0; i < es.length; i++) {
					if (player.countCards("h", { subtype: get.subtype(es[i]) })) {
						return 10;
					}
				}
				return 2;
			},
			result: {
				player(player, target) {
					if (!ui.selected.cards.length) {
						return 0;
					}
					let card = ui.selected.cards[0],
						val = -get.value(card, player) / 6;
					if (get.position(card) == "e") {
						val += 2;
					}
					if (player.hp > target.hp) {
						val++;
					} else if (player.hp < target.hp && player.isDamaged()) {
						val += get.recoverEffect(player, player, player) / get.attitude(player, player);
					}
					return val;
				},
				target(player, target) {
					if (!ui.selected.cards.length) {
						return 0;
					}
					let card = ui.selected.cards[0],
						val = get.position(card) == "e" ? get.value(card, target) / 6 : 0;
					if (target.hp > player.hp) {
						val++;
					} else if (target.hp < player.hp && target.isDamaged()) {
						val += get.recoverEffect(target, target, target) / get.attitude(target, target);
					}
					return val;
				},
			},
		},
	},
	qj_xiaoji: {
		audio: "xiaoji",
		trigger: {
			player: "loseAfter",
			global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
		},
		frequent: true,
		preHidden: true,
		getIndex(event, player) {
			const evt = event.getl(player);
			if (evt && evt.player === player && evt.es && evt.es.length) {
				return 1;
			}
			return false;
		},
		async content(event, trigger, player) {
			// @ts-expect-error 类型系统未来可期
			await player.draw(player == _status.currentPhase ? 1 : 2);
		},
		ai: {
			noe: true,
			reverseEquip: true,
			effect: {
				target(card, player, target, current) {
					if (get.type(card) == "equip" && !get.cardtag(card, "gifts")) {
						// NOTE: 这里的3是复制自标准版枭姬，乔剪版可能需要改低一点
						return [1, 3];
					}
				},
			},
		},
	},
	qj_yinghun: {
		audio: "yinghun",
		audioname: ["re_sunjian", "sunce", "re_sunben", "re_sunce", "ol_sunjian"],
		audioname2: {
			re_sunyi: "gzyinghun_re_sunyi",
			boss_sunce: "yinghun_sunce",
		},
		mod: {
			aiOrder(player, card, num) {
				if (num > 0 && _status.event && _status.event.type == "phase" && get.tag(card, "recover")) {
					if (player.needsToDiscard()) {
						return num / 3;
					}
					return 0;
				}
			},
		},
		locked: false,
		trigger: { player: "phaseZhunbeiBegin" },
		preHidden: true,
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), function (card, player, target) {
					return player != target;
				})
				.set("ai", function (target) {
					const player = _status.event.player;
					if (player.getDamagedHp() == 1 && target.countCards("he") == 0) {
						return 0;
					}
					if (get.attitude(_status.event.player, target) > 0) {
						return 10 + get.attitude(_status.event.player, target);
					}
					if (player.getDamagedHp() == 1) {
						return -1;
					}
					return 1;
				})
				.setHiddenSkill(event.name.slice(0, -5))
				.forResult();
		},
		async content(event, trigger, player) {
			const num = player.getDamagedHp();
			const [target] = event.targets;
			let directcontrol = num == 1;
			if (!directcontrol) {
				const str1 = "摸" + get.cnNumber(num, true) + "弃一";
				const str2 = "摸一弃" + get.cnNumber(num, true);
				directcontrol =
					str1 ==
					(await player
						.chooseControl(str1, str2, function (event, player) {
							if (player.isHealthy()) {
								return 1 - _status.event.choice;
							}
							return _status.event.choice;
						})
						.set("choice", get.attitude(player, target) > 0 ? 0 : 1)
						.forResultControl());
			}
			if (directcontrol) {
				if (num > 0) {
					await target.draw(num);
				}
				await target.chooseToDiscard(true, "he");
			} else {
				await target.draw();
				if (num > 0) {
					await target.chooseToDiscard(num, true, "he");
				}
			}
		},
		ai: {
			effect: {
				target(card, player, target) {
					if (
						get.tag(card, "damage") &&
						get.itemtype(player) === "player" &&
						target.hp >
							(player.hasSkillTag("damageBonus", true, {
								target: target,
								card: card,
							})
								? 2
								: 1)
					) {
						return [1, 0.5];
					}
				},
			},
			threaten(player, target) {
				return Math.max(0.5, target.getDamagedHp() / 2);
			},
			maixie: true,
		},
	},
	qj_tianxiang: {
		audio: "tianxiang",
		audioname: ["daxiaoqiao", "re_xiaoqiao", "ol_xiaoqiao"],
		trigger: { player: "damageBegin4" },
		preHidden: true,
		init(player, skill) {
			if (!player.storage[skill + "_used"]) {
				player.storage[skill + "_used"] = [false, false];
			}
		},
		filter(event, player) {
			return (
				player.countCards("he", function (card) {
					return _status.connectMode || get.suit(card, player) == "heart";
				}) > 0 && event.num > 0
			);
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCardTarget({
					filterCard(card, player) {
						return get.suit(card) == "heart" && lib.filter.cardDiscardable(card, player);
					},
					filterTarget(card, player, target) {
						return player != target;
					},
					position: "he",
					ai1(card) {
						return 10 - get.value(card);
					},
					ai2(target) {
						const att = get.attitude(_status.event.player, target);
						const trigger = _status.event.getTrigger();
						let da = 0;
						if (_status.event.player.hp == 1) {
							da = 10;
						}
						const eff = get.damageEffect(target, trigger.source, target);
						if (att == 0) {
							return 0.1 + da;
						}
						if (eff >= 0 && att > 0) {
							return att + da;
						}
						if (att > 0 && target.hp > 1) {
							if (target.maxHp - target.hp >= 3) {
								return att * 1.1 + da;
							}
							if (target.maxHp - target.hp >= 2) {
								return att * 0.9 + da;
							}
						}
						return -att + da;
					},
					prompt: get.prompt(event.skill),
					prompt2: lib.translate[`${event.skill}_info`],
				})
				.setHiddenSkill(event.name.slice(0, -5))
				.forResult();
		},
		// TODO: 待测试
		async content(event, trigger, player) {
			const [target] = event.targets;
			const [card] = event.cards;
			trigger.cancel();
			await player.discard(event.cards);

			// 获取可用的选项（过滤掉已使用的选项）
			const used = player.storage[event.name + "_used"] || [false, false];
			const choices = []; // 存储原始选项编号（0或1）
			const choiceList = [];
			const aiValues = [];

			if (!used[0]) {
				choices.push(0);
				choiceList.push("来源对其造成1点伤害，然后其摸等同其已损失体力值的牌（至多摸五张）");
				let att = get.attitude(player, target);
				if (target.hasSkillTag("maihp")) {
					att = -att;
				}
				aiValues.push(att > 0 ? 0 : 1);
			}

			if (!used[1]) {
				choices.push(1);
				choiceList.push("其失去1点体力，然后获得你弃置的牌");
				let att = get.attitude(player, target);
				if (target.hasSkillTag("maihp")) {
					att = -att;
				}
				aiValues.push(att > 0 ? 1 : 0);
			}

			if (choices.length === 0) {
				return;
			}

			const { result } = await player
				.chooseControlList(
					true,
					function (event, player, index) {
						// index 是 choiceList 中的索引，需要转换为原始选项编号
						const originalIndex = choices[index];
						const aiIndex = choices.indexOf(originalIndex);
						return aiValues[aiIndex];
					},
					choiceList
				)
				.set("target", target);

			if (typeof result.index != "number") {
				return;
			}

			// 获取原始选项编号（0或1）
			const originalChoice = choices[result.index];

			// 标记选中的选项为已使用
			player.storage[event.name + "_used"][originalChoice] = true;

			if (originalChoice) {
				// 选项2：失去体力并获得牌
				event.related = target.loseHp();
			} else {
				// 选项1：受到伤害并摸牌
				event.related = target.damage(trigger.source || "nosource", "nocard");
			}
			await event.related;
			//if(event.related.cancelled||target.isDead()) return;
			if (originalChoice && card.isInPile()) {
				await target.gain(card, "gain2");
			} else if (!originalChoice && target.getDamagedHp()) {
				await target.draw(Math.min(5, target.getDamagedHp()));
			}
		},
		subSkill: {
			clear: {
				trigger: { player: "phaseZhunbeiBegin" },
				forced: true,
				popup: false,
				content() {
					player.storage["qj_tianxiang_used"] = [false, false];
				},
			},
		},
		ai: {
			maixie_defend: true,
			effect: {
				target(card, player, target) {
					if (player.hasSkillTag("jueqing", false, target)) {
						return;
					}
					if (get.tag(card, "damage") && target.countCards("he") > 1) {
						return 0.7;
					}
				},
			},
		},
	},
	qj_hongyan: {
		audio: true,
		mod: {
			suit(card, suit) {
				if (suit == "spade") {
					return "heart";
				}
			},
		},
	},
	qj_tianyi: {
		audio: "tianyi",
		audioname: ["re_taishici"],
		enable: "phaseUse",
		usable: 1,
		filterTarget(card, player, target) {
			return player.canCompare(target);
		},
		filter(event, player) {
			return player.countCards("h") > 0;
		},
		async content(event, trigger, player) {
			const bool = await player.chooseToCompare(event.target).forResultBool();
			if (bool) {
				player.addTempSkill("tianyi2");
			} else {
				player.addTempSkill("tianyi3");
			}
		},
		ai: {
			order(name, player) {
				const cards = player.getCards("h");
				if (player.countCards("h", "sha") == 0) {
					return 1;
				}
				for (let i = 0; i < cards.length; i++) {
					if (cards[i].name != "sha" && get.number(cards[i]) > 11 && get.value(cards[i]) < 7) {
						return 9;
					}
				}
				return get.order({ name: "sha" }) - 1;
			},
			result: {
				player(player) {
					if (player.countCards("h", "sha") > 0) {
						return 0.6;
					}
					const num = player.countCards("h");
					if (num > player.hp) {
						return 0;
					}
					if (num == 1) {
						return -2;
					}
					if (num == 2) {
						return -1;
					}
					return -0.7;
				},
				target(player, target) {
					const num = target.countCards("h");
					if (num == 1) {
						return -1;
					}
					if (num == 2) {
						return -0.7;
					}
					return -0.5;
				},
			},
			threaten: 1.3,
		},
	},
	qj_hanzhan: {
		trigger: {
			global: "chooseToCompareAfter",
		},
		audio: "hanzhan",
		filter(event, player) {
			if (event.preserve) {
				return false;
			}
			if (player != event.player && player != event.target && (!event.targets || !event.targets.includes(player))) {
				return false;
			}
			for (var i of event.lose_list) {
				if (Array.isArray(i[1])) {
					for (var j of i[1]) {
						if (get.name(j, i[0]) == "sha" && get.position(j, true) == "o") {
							return true;
						}
					}
				} else {
					var j = i[1];
					if (get.name(j, i[0]) == "sha" && get.position(j, true) == "o") {
						return true;
					}
				}
			}
			return false;
		},
		frequent: true,
		prompt2(event, player) {
			var cards = [],
				max = 0;
			for (var i of event.lose_list) {
				if (Array.isArray(i[1])) {
					for (var j of i[1]) {
						if (get.name(j, i[0]) == "sha" && get.position(j, true) == "o") {
							var num = get.number(j, i[0]);
							if (num > max) {
								cards = [];
								max = num;
							}
							if (num == max) {
								cards.push(j);
							}
						}
					}
				} else {
					var j = i[1];
					if (get.name(j, i[0]) == "sha" && get.position(j, true) == "o") {
						var num = get.number(j, i[0]);
						if (num > max) {
							cards = [];
							max = num;
						}
						if (num == max) {
							cards.push(j);
						}
					}
				}
			}
			return "获得" + get.translation(cards);
		},
		content() {
			var cards = [],
				max = 0;
			for (var i of trigger.lose_list) {
				if (Array.isArray(i[1])) {
					for (var j of i[1]) {
						if (get.name(j, i[0]) == "sha" && get.position(j, true) == "o") {
							var num = get.number(j, i[0]);
							if (num > max) {
								cards = [];
								max = num;
							}
							if (num == max) {
								cards.push(j);
							}
						}
					}
				} else {
					var j = i[1];
					if (get.name(j, i[0]) == "sha" && get.position(j, true) == "o") {
						var num = get.number(j, i[0]);
						if (num > max) {
							cards = [];
							max = num;
						}
						if (num == max) {
							cards.push(j);
						}
					}
				}
			}
			player.gain(cards, "gain2");
		},
	},
	qj_buqu: {
		audio: "buqu",
		trigger: { player: "dying" },
		forced: true,
		locked: true,
		check: () => true,
		async content(event, trigger, player) {
			let num = game.getGlobalHistory("everything", evt => evt.name == "dying" && evt.player == player).length;
			await player.draw(num);
			let cards = player.getExpansions("qj_buqu");
			let result1 = await player
				.chooseCard("he", "请选择要放置的牌", true, num)
				.set("ai", function (card) {
					const existingSuits = cards.map(c => get.suit(c));
					const candidateSuits = [];
					for (const candidate of player.getCards("he")) {
						const suit = get.suit(candidate);
						if (!existingSuits.includes(suit) && !candidateSuits.includes(suit)) {
							candidateSuits.push(suit);
						}
					}
					const hasDistinctSet = candidateSuits.length >= num;
					if (!hasDistinctSet) {
						return 7 - get.value(card);
					}
					const selectedButtons = ui.selected?.buttons || [];
					const selectedSuits = selectedButtons.map(button => get.suit(button.link));
					const cardSuit = get.suit(card);
					const satisfiesSuitCondition = !selectedSuits.includes(cardSuit);
					const cardColor = get.color(card, player);
					const satisfiesColorCondition = selectedButtons.every(button => get.color(button.link, player) === cardColor);
					if (satisfiesColorCondition && satisfiesSuitCondition) {
						return 7 - get.value(card);
					}
					return -1;
				})
				.forResult();
			if (result1.bool && result1.cards && result1.cards.length) {
				const next = player.addToExpansion(result1.cards, "gain2");
				next.gaintag.add("qj_buqu");
				await next;
				cards = player.getExpansions("qj_buqu");
				if ([...new Set(cards.map(c => get.suit(c)))].length != cards.length) {
					let result2 = await player
						.chooseCardButton("请选择要移去的牌", true, player.getExpansions("qj_buqu"), [1, Infinity])
						.set("filterOk", () => {
							const selectedButtons = ui.selected?.buttons || [];
							if (!selectedButtons.length) return false;
							const selectedCards = selectedButtons.map(button => button.link);
							const remainingCards = cards.filter(card => !selectedCards.includes(card));
							if (!remainingCards.length) return false;
							const remainingSuits = remainingCards.map(card => get.suit(card));
							if (remainingSuits.length !== new Set(remainingSuits).size) return false;
							const originalSuits = [...new Set(cards.map(card => get.suit(card)))];
							if (remainingSuits.length !== originalSuits.length) return false;
							return originalSuits.every(suit => remainingSuits.includes(suit));
						})
						.forResult();
					if (result2.bool && result2.buttons && result2.buttons.length) {
						await player.loseToDiscardpile(result2.buttons);
					}
				} else {
					if (player.hp <= 0) {
						await player.recover(1 - player.hp);
					}
				}
			}
		},
	},
	qj_fenji: {
		audio: "fenji",
		group: "qj_fenji_trig",
		trigger: {
			global: "phaseJieshuBegin",
		},
		filter(event, player) {
			return player.getStorage("qj_fenji_mark")?.length;
		},
		preHidden: true,
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), function (card, player, target) {
					return player.getStorage("qj_fenji_mark")?.includes(target);
				})
				.set("ai", function (target) {
					if (get.attitude(player, event.target) <= 0) {
						return -1;
					}
					return 2 * get.effect(event.target, { name: "draw" }, player, player) + get.effect(player, { name: "losehp" }, player, player);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			player.line(event.targets[0], "green");
			await event.targets[0].draw(2);
			await player.loseHp();
		},
		subSkill: {
			trig: {
				silent: true,
				charlotte: true,
				trigger: {
					global: ["loseAfter", "equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
				},
				filter(event, player) {
					if (game.hasPlayer(target => !target.countCards("h") && event.getl?.(target)?.hs?.length)) {
						player.markAuto(
							"qj_fenji_mark",
							game.filterPlayer(target => !target.countCards("h") && event.getl?.(target)?.hs?.length)
						);
						if (!player.hasSkill("qj_fenji_mark")) {
							player.addTempSkill("qj_fenji_mark");
						}
						return true;
					}
					return false;
				},
				async content(event, trigger, player) {
					return;
				},
			},
			mark: {
				onremove: true,
				charlotte: true,
			},
		},
	},
	qj_haoshi: {
		audio: "haoshi",
		trigger: { player: "phaseDrawBegin2" },
		filter(event, player) {
			return !event.numFixed;
		},
		preHidden: true,
		check(event, player) {
			return (
				player.countCards("h") + 2 + event.num <= 5 ||
				game.hasPlayer(function (target) {
					return (
						player !== target &&
						!game.hasPlayer(function (current) {
							return current !== player && current !== target && current.countCards("h") < target.countCards("h");
						}) &&
						get.attitude(player, target) > 0
					);
				})
			);
		},
		async content(event, trigger, player) {
			trigger.num += 2;
			player.addSkill("haoshi2");
		},
		ai: {
			threaten: 2,
			noh: true,
			skillTagFilter(player, tag) {
				if (tag == "noh") {
					if (player.countCards("h") != 2) {
						return false;
					}
				}
			},
		},
	},
	qj_dimeng: {
		audio: "dimeng",
		enable: "phaseUse",
		usable: 1,
		position: "he",
		filterCard() {
			const targets = ui.selected.targets;
			if (targets.length == 2) {
				if (Math.abs(targets[0].countCards("h") - targets[1].countCards("h")) <= ui.selected.cards.length) {
					return false;
				}
			}
			return true;
		},
		selectCard: [0, Infinity],
		selectTarget: 2,
		complexCard: true,
		filterTarget(card, player, target) {
			if (player == target) {
				return false;
			}
			return true;
		},
		filterOk() {
			const targets = ui.selected.targets;
			if (targets.length != 2) {
				return false;
			}
			return Math.abs(targets[0].countCards("h") - targets[1].countCards("h")) == ui.selected.cards.length;
		},
		multitarget: true,
		multiline: true,
		async content(event, trigger, player) {
			let targets = [];
			let c1 = event.targets[0].countCards("h");
			let c2 = event.targets[1].countCards("h");
			if (c1 == c2) {
				targets = event.targets;
			} else if (c1 < c2) {
				targets = [event.targets[1]];
			} else {
				targets = [event.targets[0]];
			}
			await event.targets[0].swapHandcards(event.targets[1]);
			for (let t of targets) {
				let result = await player.chooseBool("纵横：是否令" + get.translation(t) + "获得【好施】？").set("ai", function () {
					return get.attitude(player, t) > 0;
				});
				if (result.bool) {
					t.addTempSkill("qj_haoshi", { player: "phaseEnd" });
					game.log(player, "发起了", "#y纵横", "，令", t, "获得了技能", "#g【好施】");
				}
			}
		},
		check(card) {
			const list = [],
				player = _status.event.player;
			const num = player.countCards("he");
			const players = game.filterPlayer();
			let count;
			for (let i = 0; i < players.length; i++) {
				if (players[i] != player && get.attitude(player, players[i]) > 3) {
					list.push(players[i]);
				}
			}
			list.sort(function (a, b) {
				return a.countCards("h") - b.countCards("h");
			});
			if (list.length == 0) {
				return -1;
			}
			const from = list[0];
			list.length = 0;
			for (let i = 0; i < players.length; i++) {
				if (players[i] != player && get.attitude(player, players[i]) < 1) {
					list.push(players[i]);
				}
			}
			if (list.length == 0) {
				return -1;
			}
			list.sort(function (a, b) {
				return b.countCards("h") - a.countCards("h");
			});
			if (from.countCards("h") >= list[0].countCards("h")) {
				return -1;
			}
			for (let i = 0; i < list.length && from.countCards("h") < list[i].countCards("h"); i++) {
				if (list[i].countCards("h") - from.countCards("h") <= num) {
					count = list[i].countCards("h") - from.countCards("h");
					break;
				}
			}
			if (count < 2 && from.countCards("h") >= 2) {
				return -1;
			}
			if (ui.selected.cards.length < count) {
				return 11 - get.value(card);
			}
			return -1;
		},
		ai: {
			order: 6,
			threaten: 3,
			expose: 0.9,
			result: {
				target(player, target) {
					const list = [];
					const num = player.countCards("he");
					const players = game.filterPlayer();
					if (ui.selected.targets.length == 0) {
						for (let i = 0; i < players.length; i++) {
							if (players[i] != player && get.attitude(player, players[i]) > 3) {
								list.push(players[i]);
							}
						}
						list.sort(function (a, b) {
							return a.countCards("h") - b.countCards("h");
						});
						if (target == list[0]) {
							return get.attitude(player, target);
						}
						return -get.attitude(player, target);
					} else {
						const from = ui.selected.targets[0];
						for (let i = 0; i < players.length; i++) {
							if (players[i] != player && get.attitude(player, players[i]) < 1) {
								list.push(players[i]);
							}
						}
						list.sort(function (a, b) {
							return b.countCards("h") - a.countCards("h");
						});
						if (from.countCards("h") >= list[0].countCards("h")) {
							return -get.attitude(player, target);
						}
						for (let i = 0; i < list.length && from.countCards("h") < list[i].countCards("h"); i++) {
							if (list[i].countCards("h") - from.countCards("h") <= num) {
								const count = list[i].countCards("h") - from.countCards("h");
								if (count < 2 && from.countCards("h") >= 2) {
									return -get.attitude(player, target);
								}
								if (target == list[i]) {
									return get.attitude(player, target);
								}
								return -get.attitude(player, target);
							}
						}
					}
				},
			},
		},
	},
	qj_zhijian: {
		audio: "zhijian",
		enable: "phaseUse",
		filter(event, player) {
			return player.countCards("he", { type: "equip" }) > 0;
		},
		filterCard(card) {
			return get.type(card) == "equip";
		},
		position: "he",
		check(card) {
			var player = _status.currentPhase;
			if (player.countCards("he", { subtype: get.subtype(card) }) > 1) {
				return 11 - get.equipValue(card);
			}
			return 6 - get.value(card);
		},
		filterTarget(card, player, target) {
			if (target.isMin()) {
				return false;
			}
			return player != target && target.canEquip(card);
		},
		async content(event, trigger, player) {
			await event.target.equip(event.cards[0]);
			await player.draw();
		},
		discard: false,
		lose: false,
		prepare(cards, player, targets) {
			player.$give(cards, targets[0], false);
		},
		ai: {
			basic: {
				order: 10,
			},
			result: {
				target(player, target) {
					var card = ui.selected.cards[0];
					if (card) {
						return get.effect(target, card, target, target);
					}
					return 0;
				},
			},
			threaten: 1.35,
		},
	},
	qj_guzheng: {
		audio: "guzheng",
		trigger: {
			global: ["loseAfter", "loseAsyncAfter"],
		},
		filter(event, player) {
			if (event.type != "discard") {
				return false;
			}
			if (player.hasSkill("qj_guzheng_used")) {
				return false;
			}
			var phaseName;
			for (var name of lib.phaseName) {
				var evt = event.getParent(name);
				if (!evt || evt.name != name) {
					continue;
				}
				phaseName = name;
				break;
			}
			if (!phaseName) {
				return false;
			}
			return game.hasPlayer(current => {
				if (current == player) {
					return false;
				}
				var evt = event.getl(current);
				if (!evt || !evt.cards2 || evt.cards2.filterInD("d").length < 2) {
					return false;
				}
				return true;
			});
		},
		check(event, player, cards) {
			if (cards.length > 2 || get.attitude(player, event.player) > 0) {
				return true;
			}
			for (var i = 0; i < cards.length; i++) {
				if (get.value(cards[i], event.player, "raw") < 0) {
					return true;
				}
			}
			return false;
		},
		preHidden: true,
		async content(event, trigger, player) {
			const targets = [],
				cardsList = [],
				players = game.filterPlayer().sortBySeat(_status.currentPhase);
			for (const current of players) {
				if (current == player) {
					continue;
				}
				const cards = [];
				const evt = trigger.getl(current);
				if (!evt || !evt.cards2) {
					continue;
				}
				const cardsx = evt.cards2.filterInD("d");
				cards.addArray(cardsx);
				if (cards.length) {
					targets.push(current);
					cardsList.push(cards);
				}
			}
			while (targets.length) {
				const target = targets.shift();
				let cards = cardsList.shift();
				const result = await player
					.chooseButton(2, [get.prompt("qj_guzheng", target), '<span class="text center">被选择的牌将成为对方收回的牌</span>', cards, [["获得剩余的牌", "放弃剩余的牌"], "tdnodes"]], true)
					.set("filterButton", function (button) {
						const type = typeof button.link;
						if (ui.selected.buttons.length && type == typeof ui.selected.buttons[0].link) {
							return false;
						}
						return true;
					})
					.set("check", lib.skill.qj_guzheng.check(trigger, player, cards))
					.set("ai", function (button) {
						if (typeof button.link == "string") {
							return button.link == "获得剩余的牌" ? 1 : 0;
						}
						if (_status.event.check) {
							return 20 - get.value(button.link, _status.event.getTrigger().player);
						}
						return 0;
					})
					.setHiddenSkill("qj_guzheng")
					.forResult();
				if (result?.links) {
					player.logSkill("qj_guzheng", target);
					const links = result.links;
					player.addTempSkill("qj_guzheng_used", "phaseJieshuAfter");
					if (typeof links[0] != "string") {
						links.reverse();
					}
					const card = links[1];
					await target.gain(card, "gain2");
					cards.remove(card);
					cards = cards.filterInD("d");
					if (cards.length > 0 && links[0] == "获得剩余的牌") {
						await player.gain(cards, "gain2");
					}
					break;
				}
			}
		},
		ai: {
			threaten: 1.3,
			expose: 0.2,
		},
		subSkill: {
			used: {
				charlotte: true,
			},
		},
	},
	qj_duanbing: {
		audio: "duanbing",
		inherit: "reduanbing",
		preHidden: ["gz_duanbing_sha"],
		group: ["gz_duanbing", "gz_duanbing_sha"],
		subSkill: {
			sha: {
				audio: "duanbing",
				trigger: { player: "useCardToPlayered" },
				filter(event, player) {
					return event.card.name == "sha" && !event.getParent().directHit.includes(event.target) && event.targets.length == 1;
				},
				forced: true,
				logTarget: "target",
				async content(event, trigger, player) {
					const id = trigger.target.playerid;
					const map = trigger.getParent().customArgs;
					if (!map[id]) {
						map[id] = {};
					}
					if (typeof map[id].shanRequired == "number") {
						map[id].shanRequired++;
					} else {
						map[id].shanRequired = 2;
					}
				},
				ai: {
					directHit_ai: true,
					skillTagFilter(player, tag, arg) {
						if (!arg || !arg.card || !arg.target || arg.card.name != "sha" || arg.target.countCards("h", "shan") > 1 || get.distance(player, arg.target) > 1) {
							return false;
						}
					},
				},
			},
		},
	},
	qj_fenxun: {
		audio: "fenxun",
		enable: "phaseUse",
		usable: 1,
		position: "he",
		filterTarget(card, player, target) {
			return target != player;
		},
		content() {
			player.markAuto("fenxun2", [target]);
			player.addTempSkill("fenxun2");
		},
		check(card) {
			if (card.name == "sha" && _status.event.player.countCards("h", "sha") <= 1) {
				return 0;
			}
			return 6 - get.value(card);
		},
		filterCard: true,
		ai: {
			order: 4,
			result: {
				player(player, target) {
					if (get.distance(player, target) <= 1) {
						return 0;
					}
					var hs = player.getCards("h", "shunshou");
					if (hs.length && player.canUse(hs[0], target, false)) {
						return 1;
					}
					var geteff = function (current) {
						return player.canUse("sha", current, false, true) && get.effect(current, { name: "sha" }, player, player) > 0;
					};
					if (player.hasSha() && geteff(target)) {
						var num = game.countPlayer(function (current) {
							return current != player && get.distance(player, current) <= 1 && geteff(current);
						});
						if (num == 0) {
							if (
								game.hasPlayer(function (current) {
									return player.canUse("sha", current) && geteff(current) && current != target;
								})
							) {
								return 1;
							}
						} else if (num == 1) {
							return 1;
						}
					}
					return 0;
				},
			},
		},
	},
	qj_jishi: {
		// 你可以将红色牌当【桃】对濒死角色使用，此濒死结算后，若此武将为客将，与你势力不同的角色依次选择是否用一个武将交换此武将。
	},
	qj_chuli: {
		audio: "chulao",
		enable: "phaseUse",
		usable: 1,
		filterTarget(card, player, target) {
			if (player == target) {
				return false;
			}
			for (var i = 0; i < ui.selected.targets.length; i++) {
				if (ui.selected.targets[i].isFriendOf(target)) {
					return false;
				}
			}
			return target.countCards("he") > 0;
		},
		filter(event, player) {
			return player.countCards("he") > 0;
		},
		filterCard: true,
		position: "he",
		selectTarget: [1, 3],
		check(card) {
			if (get.suit(card) == "spade") {
				return 8 - get.value(card);
			}
			return 5 - get.value(card);
		},
		contentBefore() {
			var evt = event.getParent();
			evt.draw = [];
			if (get.suit(cards[0]) == "spade") {
				evt.draw.push(player);
			}
		},
		content() {
			"step 0";
			player.discardPlayerCard(target, "he", true);
			("step 1");
			if (result.bool) {
				if (get.suit(result.cards[0]) == "spade") {
					event.getParent().draw.push(target);
				}
			}
		},
		contentAfter() {
			"step 0";
			var list = event.getParent().draw;
			if (!list.length) {
				event.finish();
			} else {
				game.asyncDraw(list);
			}
			("step 1");
			game.delay();
		},
		ai: {
			result: {
				target: -1,
			},
			tag: {
				discard: 1,
				lose: 1,
				loseCard: 1,
			},
			threaten: 1.2,
			order: 3,
		},
	},
	qj_wushuang: {
		audio: "wushuang",
		forced: true,
		locked: true,
		group: ["qj_wushuang_sha", "qj_wushuang_juedou"],
		preHidden: ["qj_wushuang_sha", "qj_wushuang_juedou"],
		subSkill: {
			sha: {
				audio: "wushuang",
				trigger: { player: "useCardToPlayered" },
				forced: true,
				sourceSkill: "qj_wushuang",
				filter(event, player) {
					return event.card.name == "sha" && !event.getParent().directHit.includes(event.target);
				},
				//priority:-1,
				logTarget: "target",
				async content(event, trigger, player) {
					const id = trigger.target.playerid;
					const map = trigger.getParent().customArgs;
					if (!map[id]) {
						map[id] = {};
					}
					if (typeof map[id].shanRequired == "number") {
						map[id].shanRequired++;
					} else {
						map[id].shanRequired = 2;
					}
				},
				ai: {
					directHit_ai: true,
					skillTagFilter(player, tag, arg) {
						if (arg.card.name != "sha" || arg.target.countCards("h", "shan") > 1) {
							return false;
						}
					},
				},
			},
			juedou: {
				audio: "wushuang",
				trigger: { player: "useCardToPlayered", target: "useCardToTargeted" },
				forced: true,
				sourceSkill: "qj_wushuang",
				logTarget(trigger, player) {
					return player == trigger.player ? trigger.target : trigger.player;
				},
				filter(event, player) {
					return event.card.name == "juedou";
				},
				//priority:-1,
				async content(event, trigger, player) {
					const id = (player == trigger.player ? trigger.target : trigger.player)["playerid"];
					const idt = trigger.target.playerid;
					const map = trigger.getParent().customArgs;
					if (!map[idt]) {
						map[idt] = {};
					}
					if (!map[idt].shaReq) {
						map[idt].shaReq = {};
					}
					if (!map[idt].shaReq[id]) {
						map[idt].shaReq[id] = 1;
					}
					map[idt].shaReq[id]++;
				},
				ai: {
					directHit_ai: true,
					skillTagFilter(player, tag, arg) {
						if (arg.card.name != "juedou" || Math.floor(arg.target.countCards("h", "sha") / 2) > player.countCards("h", "sha")) {
							return false;
						}
					},
				},
			},
		},
	},
	qj_xiaomeng: {
		trigger: { player: "useCard1" },
		filter(event, player) {
			if (event.card.name != "juedou" || !event.card.isCard || player.hasTempSkill("qj_xiaomeng_used")) {
				return false;
			}
			if (event.targets) {
				if (
					game.hasPlayer(function (current) {
						return !event.targets.includes(current) && lib.filter.targetEnabled2(event.card, player, current);
					})
				) {
					return true;
				}
			}
			return false;
		},
		async cost(event, trigger, player) {
			const num = game.countPlayer(current => !trigger.targets.includes(current) && lib.filter.targetEnabled2(trigger.card, player, current));

			event.result = await _status.currentPhase
				.chooseTarget("虓猛：是否为" + get.translation(trigger.card) + "增加" + (num > 1 ? "至多两个" : "一个") + "目标？", [1, Math.min(2, num)], (card, player, target) => {
					const trigger = get.event().getTrigger();
					const cardx = trigger.card;
					return !trigger.targets.includes(target) && lib.filter.targetEnabled2(cardx, player, target);
				})
				.set("ai", target => {
					const player = get.event().player;
					const card = get.event().getTrigger().card;
					return get.effect(target, card, player, player);
				})
				.setHiddenSkill("gzwushuang")
				.forResult();

			if (event.result.bool && player != game.me && !player.isOnline()) {
				await game.delayx();
			}
		},
		logTarget: "targets",
		async content(event, trigger, player) {
			const targets = event.targets.sortBySeat();
			trigger.targets.addArray(targets);
			player.addTempSkill("qj_xiaomeng_used");
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
		},
	},
	qj_lijian: {
		audio: "lijian",
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return game.countPlayer(current => current != player && current.hasSex("male")) > 1;
		},
		check(card) {
			return 10 - get.value(card);
		},
		filterCard: true,
		position: "he",
		filterTarget(card, player, target) {
			if (player == target) {
				return false;
			}
			if (!target.hasSex("male")) {
				return false;
			}
			if (ui.selected.targets.length == 1) {
				return target.canUse({ name: "juedou" }, ui.selected.targets[0]);
			}
			return true;
		},
		targetprompt: ["先出杀", "后出杀"],
		selectTarget: 2,
		multitarget: true,
		async content(event, trigger, player) {
			const useCardEvent = event.targets[1].useCard({ name: "juedou", isCard: true }, "nowuxie", event.targets[0], "noai");
			useCardEvent.animate = false;
			await game.delay(0.5);
		},
		ai: {
			order: 8,
			result: {
				target(player, target) {
					if (ui.selected.targets.length == 0) {
						return -3;
					} else {
						return get.effect(target, { name: "juedou" }, ui.selected.targets[0], target);
					}
				},
			},
			expose: 0.4,
			threaten: 3,
		},
	},
	qj_biyue: {
		audio: "biyue",
		audioname2: { sp_diaochan: "biyue" },
		trigger: { player: "phaseJieshuBegin" },
		frequent: true,
		content() {
			player.draw(player.countCards("h") ? 1 : 2);
		},
	},
	qj_luanji: {
		audio: "luanji",
		enable: "phaseUse",
		viewAs: {
			name: "wanjian",
		},
		filterCard(card, player) {
			if (!player.storage.qj_luanji) {
				return true;
			}
			return !player.storage.qj_luanji.includes(get.suit(card));
		},
		selectCard: 2,
		position: "hs",
		filter(event, player) {
			return (
				player.countCards("hs", function (card) {
					return !player.storage.qj_luanji || !player.storage.qj_luanji.includes(get.suit(card));
				}) > 1
			);
		},
		check(card) {
			const player = get.player();
			const targets = game.filterPlayer(current => player.canUse("wanjian", cast(current)) ?? false);
			let num = 0;
			for (let i = 0; i < targets.length; i++) {
				let eff = get.sgn(get.effect(targets[i], { name: "wanjian" }, player, player));
				if (targets[i].hp == 1) {
					eff *= 1.5;
				}
				num += eff;
			}
			if (!player.needsToDiscard(-1)) {
				if (targets.length >= 7) {
					if (num < 2) {
						return 0;
					}
				} else if (targets.length >= 5) {
					if (num < 1.5) {
						return 0;
					}
				}
			}
			return 6 - get.value(card);
		},
		group: ["qj_luanji_count", "qj_luanji_reset", "qj_luanji_respond"],
		subSkill: {
			reset: {
				trigger: {
					player: "phaseAfter",
				},
				silent: true,
				filter(event, player) {
					return player.storage.qj_luanji ? true : false;
				},
				async content(event, trigger, player) {
					delete player.storage.qj_luanji;
				},
				sub: true,
				forced: true,
				popup: false,
			},
			count: {
				trigger: {
					player: "useCard",
				},
				silent: true,
				filter(event) {
					return event.skill == "qj_luanji";
				},
				async content(event, trigger, player) {
					if (!player.storage.qj_luanji) {
						player.storage.qj_luanji = [];
					}
					for (let i = 0; i < trigger.cards.length; i++) {
						player.storage.qj_luanji.add(get.suit(trigger.cards[i]));
					}
				},
				sub: true,
				forced: true,
				popup: false,
			},
			respond: {
				trigger: {
					global: "respond",
				},
				silent: true,
				filter(event) {
					if (event.player.isUnseen()) {
						return false;
					}
					// @ts-expect-error 类型系统未来可期
					return event.getParent(2).skill == "qj_luanji" && event.player.isFriendOf(_status.currentPhase);
				},
				async content(event, trigger, player) {
					await trigger.player.draw();
				},
				sub: true,
				forced: true,
				popup: false,
			},
		},
	},
	qj_shuangxiong: {
		audio: "shuangxiong",
		trigger: { player: "phaseDrawEnd" },
		filter: (event, player) => player.countCards("he") > 0,
		async cost(event, trigger, player) {
			event.result = await player
				.chooseToDiscard("he", get.prompt("qj_shuangxiong"), "弃置一张牌，然后你本回合内可以将一张与此牌颜色不同的牌当做【决斗】使用", "chooseonly")
				.set("ai", function (card) {
					let player = _status.event.player;
					if (!_status.event.goon || player.skipList.includes("phaseUse")) {
						return -get.value(card);
					}
					let color = get.color(card),
						effect = 0,
						cards = player.getCards("hes"),
						sha = false;
					for (const cardx of cards) {
						if (cardx == card || get.color(cardx) == color) {
							continue;
						}
						const cardy = get.autoViewAs({ name: "juedou" }, [cardx]),
							eff1 = player.getUseValue(cardy);
						if (get.position(cardx) == "e") {
							let eff2 = get.value(cardx);
							if (eff1 > eff2) {
								effect += eff1 - eff2;
							}
							continue;
						} else if (get.name(cardx) == "sha") {
							if (sha) {
								effect += eff1;
								continue;
							} else {
								sha = true;
							}
						}
						let eff2 = player.getUseValue(cardx, null, true);
						if (eff1 > eff2) {
							effect += eff1 - eff2;
						}
					}
					return effect - get.value(card);
				})
				.set("goon", player.hasValueTarget({ name: "juedou" }) && !player.hasSkill("qj_shuangxiong_effect"))
				.forResult();
		},
		async content(event, trigger, player) {
			const { cards } = event,
				color = get.color(cards[0], player);
			await player.modedDiscard(cards);
			player.markAuto("qj_shuangxiong_effect", [color]);
			player.addTempSkill("qj_shuangxiong_effect");
		},
		group: "qj_shuangxiong_jianxiong",
		subSkill: {
			effect: {
				audio: "shuangxiong",
				enable: "chooseToUse",
				viewAs: { name: "juedou" },
				position: "hes",
				viewAsFilter(player) {
					return player.hasCard(card => lib.skill.qj_shuangxiong_effect.filterCard(card, player), "hes");
				},
				filterCard(card, player) {
					const color = get.color(card),
						colors = player.getStorage("qj_shuangxiong_effect");
					for (const i of colors) {
						if (color != i) {
							return true;
						}
					}
					return false;
				},
				prompt() {
					const colors = _status.event.player.getStorage("qj_shuangxiong_effect");
					let str = "将一张颜色";
					for (let i = 0; i < colors.length; i++) {
						if (i > 0) {
							str += "或";
						}
						str += "不为";
						str += get.translation(colors[i]);
					}
					str += "的牌当做【决斗】使用";
					return str;
				},
				check(card) {
					const player = _status.event.player;
					if (get.position(card) == "e") {
						const raw = get.value(card);
						const eff = player.getUseValue(get.autoViewAs({ name: "juedou" }, [card]));
						return eff - raw;
					}
					const raw = player.getUseValue(card, null, true);
					const eff = player.getUseValue(get.autoViewAs({ name: "juedou" }, [card]));
					return eff - raw;
				},
				onremove: true,
				charlotte: true,
				ai: { order: 7 },
			},
			jianxiong: {
				audio: "qj_shuangxiong",
				trigger: { player: "phaseJieshuBegin" },
				forced: true,
				locked: false,
				filter(event, player) {
					return player.hasHistory("damage", function (evt) {
						//Disable Umi Kato's chaofan
						return evt.card && evt.cards && evt.cards.some(card => get.position(card, true));
					});
				},
				content() {
					const cards = [];
					player.getHistory("damage", function (evt) {
						if (evt.card && evt.cards) {
							cards.addArray(evt.cards.filterInD("d"));
						}
					});
					if (cards.length) {
						player.gain(cards, "gain2");
					}
				},
			},
		},
	},
	qj_wansha: {
		locked: true,
		audio: "wansha",
		global: "wansha2",
		trigger: { global: "dying" },
		priority: 15,
		forced: true,
		preHidden: true,
		filter(event, player, name) {
			return _status.currentPhase == player && event.player != player;
		},
		async content() {},
	},
	qj_luanwu: {
		audio: "luanwu",
		enable: "phaseUse",
		filter(event, player) {
			return game.hasPlayer(current => player != current);
		},
		limited: true,
		skillAnimation: "epic",
		animationColor: "thunder",
		filterTarget: lib.filter.notMe,
		selectTarget: -1,
		multiline: true,
		async contentBefore(event, trigger, player) {
			player.awakenSkill(event.skill);
		},
		async content(event, trigger, player) {
			const { target } = event;
			const { result } = await target
				.chooseToUse(
					"乱武：使用一张【杀】或失去1点体力",
					function (card) {
						if (get.name(card) != "sha") {
							return false;
						}
						return lib.filter.filterCard.apply(this, arguments);
					},
					function (card, player, target) {
						if (player == target) {
							return false;
						}
						var dist = get.distance(player, target);
						if (dist > 1) {
							if (
								game.hasPlayer(function (current) {
									return current != player && get.distance(player, current) < dist;
								})
							) {
								return false;
							}
						}
						return lib.filter.filterTarget.apply(this, arguments);
					}
				)
				.set("ai2", function () {
					return get.effect_use.apply(this, arguments) - get.event("effect");
				})
				.set("effect", get.effect(target, { name: "losehp" }, target, target))
				.set("addCount", false);
			if (!result?.bool) {
				await target.loseHp();
			}
		},
		ai: {
			order: 1,
			result: {
				player(player) {
					if (lib.config.mode == "identity" && game.zhu.isZhu && player.identity == "fan") {
						if (game.zhu.hp == 1 && game.zhu.countCards("h") <= 2) {
							return 1;
						}
					}
					const players = game.filterPlayer();
					let num = 0;
					for (let i = 0; i < players.length; i++) {
						let att = get.attitude(player, players[i]);
						if (att > 0) {
							att = 1;
						}
						if (att < 0) {
							att = -1;
						}
						if (players[i] != player && players[i].hp <= 3) {
							const hs = players[i].countCards("hs");
							if (hs === 0) {
								num += att / players[i].hp;
							} else if (hs === 1) {
								num += att / 2 / players[i].hp;
							} else if (hs === 2) {
								num += att / 4 / players[i].hp;
							}
						}
						if (players[i].hp == 1) {
							num += att * 1.5;
						}
					}
					if (player.hp == 1) {
						return -num;
					}
					if (player.hp == 2) {
						return -game.players.length / 4 - num;
					}
					return -game.players.length / 3 - num;
				},
			},
		},
	},
	qj_weimu: {
		audio: "weimu",
		trigger: {
			target: "useCardToTarget",
			player: "addJudgeBefore",
		},
		forced: true,
		priority: 15,
		preHidden: true,
		check(event, player) {
			return event.name == "addJudge" || (event.card.name != "chiling" && get.effect(event.target, event.card, event.player, player) < 0);
		},
		filter(event, player) {
			if (event.name == "addJudge") {
				return get.color(event.card) == "black";
			}
			return get.type(event.card, null, false) == "trick" && get.color(event.card) == "black";
		},
		async content(event, trigger, player) {
			if (trigger.name == "addJudge") {
				trigger.cancel(undefined, undefined, undefined);
				const owner = get.owner(trigger.card);
				if (owner?.getCards("hej").includes(trigger.card)) {
					await owner.lose(trigger.card, ui.discardPile);
				} else {
					await game.cardsDiscard(trigger.card);
				}
				game.log(trigger.card, "进入了弃牌堆");
			} else {
				// @ts-expect-error 类型系统未来可期
				trigger.getParent()?.targets.remove(player);
			}
		},
		ai: {
			effect: {
				target(card, player, target, current) {
					if (get.type(card, "trick") == "trick" && get.color(card) == "black") {
						return "zeroplayertarget";
					}
				},
			},
		},
	},
	qj_menghan: {
		audio: "jianchu",
		trigger: { player: "useCardToPlayered" },
		filter(event, player) {
			return event.card.name == "sha" && event.target.countDiscardableCards(player, "he") > 0;
		},
		preHidden: true,
		check(event, player) {
			return get.attitude(player, event.target) <= 0;
		},
		logTarget: "target",
		async content(event, trigger, player) {
			const { result } = await player
				.discardPlayerCard(trigger.target, get.prompt("jianchu", trigger.target), true)
				.set("ai", function (button) {
					if (!_status.event.att) {
						return 0;
					}
					if (get.position(button.link) == "e") {
						if (get.subtype(button.link) == "equip2") {
							return 5 * get.value(button.link);
						}
						return get.value(button.link);
					}
					return 1;
				})
				.set("att", get.attitude(player, trigger.target) <= 0);
			if (result.bool && result.links && result.links.length) {
				if (get.type(result.links[0], null, result.links[0].original == "h" ? player : false) == "equip") {
					trigger.getParent().directHit.add(trigger.target);
				} else if (trigger.cards) {
					const list = [];
					for (let i = 0; i < trigger.cards.length; i++) {
						if (get.position(trigger.cards[i], true) == "o") {
							list.push(trigger.cards[i]);
						}
					}
					if (list.length) {
						trigger.target.gain(list, "gain2", "log");
					}
				}
			}
		},
		ai: {
			unequip_ai: true,
			directHit_ai: true,
			skillTagFilter(player, tag, arg) {
				if (tag == "directHit_ai") {
					return (
						arg.card.name == "sha" &&
						arg.target.countCards("e", function (card) {
							return get.value(card) > 1;
						}) > 0
					);
				}
				if (arg && arg.name == "sha" && arg.target.getEquip(2)) {
					return true;
				}
				return false;
			},
		},
	},
	qj_leiji: {
		audio: "leiji",
		audioname: ["boss_qinglong"],
		trigger: { player: ["useCard", "respond"] },
		filter(event, player) {
			return event.card.name == "shan";
		},
		line: "thunder",
		async cost(event, trigger, player) {
			const next = player.chooseTarget(get.prompt2(event.skill), function (card, player, target) {
				return target != player;
			});
			next.ai = function (target) {
				if (target.hasSkill("hongyan")) {
					return 0;
				}
				return get.damageEffect(target, _status.event.player, _status.event.player, "thunder");
			};
			event.result = await next.forResult();
		},
		async content(event, trigger, player) {
			const [target] = event.targets;
			const next = target.judge(function (card) {
				const suit = get.suit(card);
				if (suit == "spade") {
					return -4;
				}
				if (suit == "club") {
					return -2;
				}
				return 0;
			});
			next.judge2 = function (result) {
				return result.bool == false; // ? true : false; 喵？
			};
			const { suit } = await next.forResult();
			if (suit == "club") {
				await player.recover();
				await target.damage("thunder");
			} else if (suit == "spade") {
				await target.damage(2, "thunder");
			}
		},
		ai: {
			useShan: true,
			effect: {
				target_use(card, player, target, current) {
					if (
						get.tag(card, "respondShan") &&
						!player.hasSkillTag(
							"directHit_ai",
							true,
							{
								target: target,
								card: card,
							},
							true
						)
					) {
						let club = 0,
							spade = 0;
						if (
							game.hasPlayer(function (current) {
								return get.attitude(target, current) < 0 && get.damageEffect(current, target, target, "thunder") > 0;
							})
						) {
							club = 2;
							spade = 4;
						}
						if (!target.isHealthy()) {
							club += 2;
						}
						if (!club && !spade) {
							return 1;
						}
						if (card.name === "sha") {
							if (!target.mayHaveShan(player, "use")) {
								return;
							}
						} else if (!target.mayHaveShan(player)) {
							return 1 - 0.1 * Math.min(5, target.countCards("hs"));
						}
						if (!target.hasSkillTag("rejudge")) {
							return [1, (club + spade) / 4];
						}
						let pos = player.hasSkillTag("viewHandcard", null, target, true) ? "hes" : "e",
							better = club > spade ? "club" : "spade",
							max = 0;
						target.hasCard(function (cardx) {
							if (get.suit(cardx) === better) {
								max = 2;
								return true;
							}
							if (spade && get.color(cardx) === "black") {
								max = 1;
							}
						}, pos);
						if (max === 2) {
							return [1, Math.max(club, spade)];
						}
						if (max === 1) {
							return [1, Math.min(club, spade)];
						}
						if (pos === "e") {
							return [1, Math.min((Math.max(1, target.countCards("hs")) * (club + spade)) / 4, Math.max(club, spade))];
						}
						return [1, (club + spade) / 4];
					}
				},
			},
		},
	},
	qj_guidao: {
		audio: "guidao",
		audioname: ["sp_zhangjiao"],
		trigger: { global: "judge" },
		filter(event, player) {
			return player.countCards("hes", { color: "black" }) > 0;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCard(get.translation(trigger.player) + "的" + (trigger.judgestr || "") + "判定为" + get.translation(trigger.player.judging[0]) + "，" + get.prompt(event.skill), "hes", function (card) {
					if (get.color(card) != "black") {
						return false;
					}
					const player = _status.event.player;
					const mod2 = game.checkMod(card, player, "unchanged", "cardEnabled2", player);
					if (mod2 != "unchanged") {
						return mod2;
					}
					const mod = game.checkMod(card, player, "unchanged", "cardRespondable", player);
					if (mod != "unchanged") {
						return mod;
					}
					return true;
				})
				.set("ai", function (card) {
					const trigger = _status.event.getTrigger();
					const player = _status.event.player;
					const judging = _status.event.judging;
					let result = trigger.judge(card) - trigger.judge(judging);
					const attitude = get.attitude(player, trigger.player);
					let val = get.value(card);
					if (get.subtype(card) == "equip2") {
						val /= 2;
					} else {
						val /= 6;
					}
					if (attitude == 0 || result == 0) {
						return 0;
					}
					if (attitude > 0) {
						return result - val;
					}
					return -result - val;
				})
				.set("judging", trigger.player.judging[0])
				.forResult();
		},
		async content(event, trigger, player) {
			await player.respond(event.cards, "highlight", "guidao", "noOrdering");
			player.$gain2(trigger.player.judging[0]);
			await player.gain(trigger.player.judging[0]);
			trigger.player.judging[0] = event.cards[0];
			trigger.orderingCards.addArray(event.cards);
			game.log(trigger.player, "的判定牌改为", event.cards[0]);
			await game.delay(2);
		},
		ai: {
			rejudge: true,
			tag: {
				rejudge: 1,
			},
		},
	},
	qj_beige: {
		audio: "beige",
		audioname: ["re_caiwenji", "ol_caiwenji"],
		trigger: { global: "damageEnd" },
		filter(event, player) {
			return event.card && event.card.name == "sha" && event.source && event.player.isIn() && player.countCards("he");
		},
		checkx(event, player) {
			const att1 = get.attitude(player, event.player);
			const att2 = get.attitude(player, event.source);
			return att1 > 0 && att2 <= 0;
		},
		preHidden: true,
		async cost(event, trigger, player) {
			const next = player.chooseToDiscard("he", get.prompt2(event.skill, trigger.player));
			const check = lib.skill.beige.checkx(trigger, player);
			next.set("ai", function (card) {
				if (_status.event.goon) {
					return 8 - get.value(card);
				}
				return 0;
			});
			next.set("goon", check);
			next.setHiddenSkill(event.skill);
			event.result = await next.forResult();
		},
		async content(event, trigger, player) {
			const { result } = await trigger.player.judge();
			switch (result.suit) {
				case "heart":
					await trigger.player.recover();
					break;
				case "diamond":
					await trigger.player.draw(2);
					break;
				case "club":
					await trigger.source.chooseToDiscard("he", 2, true);
					break;
				case "spade":
					if (!trigger.source.isTurnedOver()) {
						await trigger.source.turnOver();
					}
					break;
			}
		},
		ai: {
			expose: 0.3,
		},
	},
	qj_duanchang: {
		audio: "duanchang",
		trigger: {
			player: "die",
		},
		forced: true,
		forceDie: true,
		filter(event, player) {
			/** @type {PlayerGuozhan} */
			const source = cast(event.source);
			return event.source && event.source.isIn() && event.source != player && (source.hasMainCharacter() || source.hasViceCharacter());
		},
		logTarget: "source",
		async content(event, trigger, player) {
			/** @type {PlayerGuozhan} */
			const source = cast(trigger.source);

			const main = source.hasMainCharacter();
			const vice = source.hasViceCharacter();

			/** @type {Partial<Result>} */
			let result;
			if (!vice) {
				result = { control: "主将" };
			} else if (!main) {
				result = { control: "副将" };
			} else {
				result = await player
					// @ts-expect-error 类型系统未来可期
					.chooseControl("主将", "副将", () => get.event().choice)
					.set("prompt", "令" + get.translation(trigger.source) + "失去一张武将牌的所有技能")
					.set("forceDie", true)
					.set(
						"choice",
						(() => {
							let rank = get.guozhanRank(trigger.source.name1, cast(source)) - get.guozhanRank(trigger.source.name2, cast(source));
							if (rank == 0) {
								rank = Math.random() > 0.5 ? 1 : -1;
							}
							return rank * get.attitude(player, trigger.source) > 0 ? "副将" : "主将";
						})()
					)
					.forResult();
			}

			let skills;
			if (result.control == "主将") {
				trigger.source.showCharacter(0);
				broadcastAll(player => {
					player.node.avatar.classList.add("disabled");
				}, trigger.source);
				skills = lib.character[trigger.source.name][3];
				game.log(trigger.source, "失去了主将技能");
			} else {
				trigger.source.showCharacter(1);
				broadcastAll(player => {
					player.node.avatar2.classList.add("disabled");
				}, trigger.source);
				skills = lib.character[trigger.source.name2][3];
				game.log(trigger.source, "失去了副将技能");
			}
			const list = [];
			for (let i = 0; i < skills.length; i++) {
				list.add(skills[i]);
				const info = lib.skill[skills[i]];
				if (info.charlotte) {
					list.splice(i--);
					continue;
				}
				if (typeof info.derivation == "string") {
					list.add(info.derivation);
				} else if (Array.isArray(info.derivation)) {
					list.addArray(info.derivation);
				}
			}
			trigger.source.removeSkill(list);
			trigger.source.syncSkills();
			player.line(trigger.source, "green");
		},
		ai: {
			threaten(player, target) {
				if (target.hp == 1) {
					return 0.2;
				}
				return 1.5;
			},
			effect: {
				target(card, player, target, current) {
					if (!target.hasFriend()) {
						return;
					}
					if (target.hp <= 1 && get.tag(card, "damage")) {
						return [1, 0, 0, -2];
					}
				},
			},
		},
	},
	qj_xiongyi: {
		skillAnimation: true,
		animationColor: "gray",
		enable: "phaseUse",
		audio: "xiongyi",
		limited: true,
		filterTarget(card, player, target) {
			if (player == target) {
				return true;
			}
			if (player.identity == "unknown") {
				if (!player.wontYe("qun")) {
					return false;
				}
				return target.identity == "qun";
			}
			return target.isFriendOf(player);
		},
		multitarget: true,
		multiline: true,
		selectTarget() {
			if (get.mode() == "guozhan") {
				return -1;
			}
			return [1, Infinity];
		},
		content() {
			"step 0";
			player.awakenSkill(event.name);
			game.asyncDraw(targets, 3);
			("step 1");
			if (player.isDamaged()) {
				if (get.mode() == "guozhan") {
					if (player.isMinor(true)) {
						player.recover();
					}
				} else if (player.isMinHp()) {
					player.recover();
				}
			}
		},
		ai: {
			order: 7,
		},
	},
	qj_shuangren: {
		audio: "shuangren",
		trigger: { player: "phaseUseBegin" },
		preHidden: true,
		filter(event, player) {
			return (
				player.countCards("h") > 0 &&
				game.hasPlayer(function (current) {
					return current != player && player.canCompare(current);
				})
			);
		},
		async cost(event, trigger, player) {
			var goon;
			if (player.needsToDiscard() > 1) {
				goon = player.hasCard(function (card) {
					return card.number > 10 && get.value(card) <= 5;
				});
			} else if (player.hasSha()) {
				goon = player.hasCard(function (card) {
					return (card.number >= 9 && get.value(card) <= 5) || get.value(card) <= 3;
				});
			} else {
				goon = player.hasCard(function (card) {
					return get.value(card) <= 5;
				});
			}
			event.result = await player
				.chooseTarget(get.prompt2("qj_shuangren"), function (card, player, target) {
					return player.canCompare(target);
				})
				.set("ai", function (target) {
					var player = _status.event.player;
					if (_status.event.goon && get.attitude(player, target) < 0) {
						return get.effect(target, { name: "sha" }, player, player);
					}
					return 0;
				})
				.set("goon", goon)
				.setHiddenSkill(event.name)
				.forResult();
		},
		async content(event, trigger, player) {
			var target = event.targets[0];
			player.logSkill("qj_shuangren", target);
			let result = await player.chooseToCompare(target).forResult();
			if (result.bool) {
				if (game.hasPlayer(current => target != current && player.canUse("sha", current, false))) {
					var str = "请选择视为使用【杀】的目标";
					var str2 = "操作提示：选择一名角色，或选择包含" + get.translation(target) + "在内的两名角色";
					let result2 = await player
						.chooseTarget([1, 2], str, str2, true, function (card, player, target) {
							if (!player.canUse("sha", target, false)) {
								return false;
							}
							var current = _status.event.target;
							if (target == current) {
								return true;
							}
							if (!ui.selected.targets.length) {
								return true;
							}
							return ui.selected.targets[0] == current;
						})
						.set("ai", function (target) {
							var player = _status.event.player;
							return get.effect(target, { name: "sha" }, player, player);
						})
						.set("target", target)
						.set("complexTarget", true);
					if (result2.bool && result2.targets && result2.targets.length) {
						await player.useCard({ name: "sha", isCard: true }, result2.targets, false);
					}
				} else {
					await player.useCard({ name: "sha", isCard: true }, target, false);
					return;
				}
			} else {
				player.addTempSkill("qj_shuangren_debuff");
				return;
			}
		},
		subSkill: {
			debuff: {
				charlotte: true,
				mod: {
					cardname(card) {
						if (card.name == "sha") {
							return "jiedao";
						}
					},
				},
			},
		},
	},
	qj_sijian: {
		trigger: {
			player: ["loseAfter", "changeHp"],
			global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
		},
		audio: "sijian",
		preHidden: true,
		filter(event, player) {
			if (event.name == "changeHp") {
				return player.getHp() == 1;
			}
			if (player.countCards("h")) {
				return false;
			}
			if (event.name == "gain" && event.player == player) {
				return false;
			}
			var evt = event.getl(player);
			return evt && evt.hs && evt.hs.length > 0;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt("sijian"), "弃置一名其他角色的一张牌", function (card, player, target) {
					return player != target && target.countCards("he") > 0;
				})
				.set("ai", function (target) {
					return -get.attitude(_status.event.player, target);
				})
				.setHiddenSkill(event.name)
				.forResult();
		},
		async content(event, trigger, player) {
			player.logSkill("qj_sijian", event.targets);
			await player.discardPlayerCard(event.targets[0], true);
		},
		ai: {
			expose: 0.2,
		},
	},
	qj_suishi: {
		audio: "suishi",
		locked: true,
		forced: true,
		preHidden: ["qj_suishi_draw", "qj_suishi_lopse"],
		group: ["qj_suishi_draw", "qj_suishi_lopse"],
		/** @type {Record<string, Skill>} */
		subSkill: {
			draw: {
				audio: "suishi1",
				trigger: {
					global: "dying",
				},
				check() {
					return false;
				},
				filter(event, player) {
					return event.player != player && event.parent?.name == "damage" && event.parent.source && event.parent.source.isFriendOf(player);
				},
				async content(_event, _trigger, player) {
					await player.draw();
				},
			},
			lose: {
				audio: "suishi2",
				trigger: {
					global: "dieAfter",
				},
				forced: true,
				filter(event, player) {
					return event.player.isFriendOf(player);
				},
				async content(_event, _trigger, player) {
					if (player.countCards("h") == 0) {
						await player.loseHp();
					} else {
						let result = await player.chooseControl("失去一点体力", "弃置所有手牌").set(
							"choice",
							(function () {
								if (player.countCards("h") <= 2 || player.hp < 2) {
									return "弃置所有手牌";
								}
								return "失去一点体力";
							})()
						);
						if (result == "失去一点体力") {
							await player.loseHp();
						} else {
							await player.discard(player.getCards("h"));
						}
					}
				},
			},
		},
	},
	qj_kuangfu: {
		enable: "phaseUse",
		usable: 1,
		audio: "kuangfu",
		delay: false,
		filterTarget(card, player, target) {
			if (player == target) {
				return (
					player.countCards("e", function (card) {
						return lib.filter.cardDiscardable(card, player);
					}) > 0
				);
			}
			return target.countDiscardableCards(player, "e") > 0;
		},
		filter(event, player) {
			return game.hasPlayer(function (current) {
				return current.countCards("e") > 0;
			});
		},
		useShaValue(player) {
			let cache = _status.event.getTempCache("qj_kuangfu", "useShaValue");
			if (cache) {
				return cache;
			}
			let eff = -Infinity,
				odds = 0,
				tar = null;
			game.countPlayer(cur => {
				if (!player.canUse("sha", cur, false)) {
					return;
				}
				let eff2 = get.effect(cur, { name: "sha" }, player, player);
				if (eff2 < eff) {
					return;
				}
				let directHit = 1 - cur.mayHaveShan(player, "use", true, "odds");
				if (get.attitude(player, cur) > 0) {
					directHit = 1;
				} else {
					eff2 *= directHit;
				}
				if (eff2 <= eff) {
					return;
				}
				tar = cur;
				eff = eff2;
				odds = directHit;
			});
			_status.event.putTempCache("qj_kuangfu", "useShaValue", {
				tar,
				eff,
				odds,
			});
			return { tar, eff, odds };
		},
		content() {
			"step 0";
			if (player == target) {
				player.chooseToDiscard("e", true);
			} else {
				player.discardPlayerCard(target, "e", true);
			}
			("step 1");
			player.chooseUseTarget("sha", true, false);
			("step 2");
			var bool = game.hasPlayer2(function (current) {
				return (
					current.getHistory("damage", function (evt) {
						return evt.getParent("qj_kuangfu") == event;
					}).length > 0
				);
			});
			if (player == target && bool) {
				player.draw(2);
			} else if (player != target && !bool) {
				player.chooseToDiscard("h", 2, true);
			}
		},
		ai: {
			order() {
				return get.order({ name: "sha" }) - 0.3;
			},
			result: {
				player(player, target) {
					let cache = lib.skill.qj_kuangfu.useShaValue(player),
						eff = cache.eff / 10;
					if (player === target) {
						return 2 * cache.odds + eff;
					}
					return Math.min(2, player.countCards("h")) * (cache.odds - 1) + eff;
				},
				target(player, target) {
					let att = get.attitude(player, target),
						max = 0,
						min = 1;
					target.countCards("e", function (card) {
						var val = get.value(card, target);
						if (val > max) {
							max = val;
						}
						if (val < min) {
							min = val;
						}
					});
					if (att <= 0) {
						if (target.hasSkillTag("noe")) {
							return 2 - max / 3;
						}
						if (min <= 0) {
							return 1;
						}
						return -max / 3;
					}
					if (target.hasSkillTag("noe")) {
						return 2 - min / 4;
					}
					if (min <= 0) {
						return 1;
					}
					if (player === target) {
						let cache = lib.skill.qj_kuangfu.useShaValue(player);
						return cache.eff / 10 - 1;
					}
					return 0;
				},
			},
		},
	},
	qj_huoshui: {
		global: "qj_huoshui_mingzhi",
		enable: "phaseUse",
		filter(event, player) {
			return (
				player.countCards("he", { color: "black" }) > 0 &&
				game.hasPlayer(function (current) {
					return current != player && !current.isUnseen(2);
				})
			);
		},
		filterCard: {
			color: "black",
		},
		position: "he",
		filterTarget(card, player, target) {
			if (target == player) {
				return false;
			}
			return !target.isUnseen(2);
		},
		check(card) {
			return 6 - get.value(card, get.event().player);
		},
		async content(event, trigger, player) {
			let target = event.target;
			let result;
			if (get.is.jun(cast(target))) {
				result = { control: "副将" };
			} else {
				let choice = "主将";
				const skills = lib.character[target.name2][3];
				for (var i = 0; i < skills.length; i++) {
					var info = get.info(skills[i]);
					if (info && info.ai && info.ai.maixie) {
						choice = "副将";
						break;
					}
				}
				if (get.character(target.name, 3).includes("buqu")) {
					choice = "主将";
				} else if (get.character(target.name2, 3).includes("buqu")) {
					choice = "副将";
				}
				result = await player
					.chooseControl("主将", "副将", () => {
						// @ts-expect-error 类型系统未来可期
						return _status.event.choice;
					})
					.set("prompt", "暗置" + get.translation(event.target) + "的一张武将牌")
					.set("choice", choice)
					.forResult();
			}

			if (result.control == "主将") {
				target.hideCharacter(0);
			} else {
				target.hideCharacter(1);
			}
			target.addTempSkill("qingcheng_ai");
			if (target.countCards("he") > 0) {
				let result1 = await target.chooseCard("he", true).forResult();
				if (result1.bool) {
					await target.give(result1.cards, player);
				}
			}
		},
		ai: {
			order: 8,
			result: {
				target(player, target) {
					if (target.hp <= 0) {
						return -5;
					}
					if (player.getStat().skill.gz_qingcheng) {
						return 0;
					}
					if (!target.hasSkillTag("maixie")) {
						return 0;
					}
					if (get.attitude(player, target) >= 0) {
						return 0;
					}
					if (
						player.hasCard(function (card) {
							return get.tag(card, "damage") && player.canUse(card, target, cast(true), true);
						}, undefined)
					) {
						if (target.maxHp > 3) {
							return -0.5;
						}
						return -1;
					}
					return 0;
				},
			},
		},
		subSkill: {
			mingzhi: {
				ai: {
					nomingzhi: true,
					skillTagFilter(player) {
						// @ts-expect-error 类型系统未来可期
						if (_status.currentPhase && _status.currentPhase != player && _status.currentPhase.hasSkill("qj_huoshui")) {
							return true;
						}
						return false;
					},
				},
			},
		},
	},
	qj_qingcheng: {
		audio: "qingcheng",
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return game.hasPlayer(current => lib.skill.reqingcheng.filterTarget(null, player, current));
		},
		filterTarget(card, player, target) {
			return target != player && target.hasSex("male") && target.countCards("h") <= player.countCards("h");
		},
		content() {
			player.swapHandcards(target);
		},
		ai: {
			order: 1,
			result: {
				player(player, target) {
					if (target.countCards("h") > 0) {
						return -Math.max(get.value(target.getCards("h"), player) - get.value(player.getCards("h"), player), 0);
					}
					return 0;
				},
			},
		},
	},
	qj_xiaoni: {
		limited: true,
		enable: "phaseUse",
		filterTarget(card, player, target) {
			return target != player && !target.isFriendOf(player);
		},
		selectTarget: [1, Infinity],
		multitarget: true,
		async content(event, trigger, player) {
			var card = { name: "sha", isCard: true };
			await player.useCard(card, event.targets).forResult();
			let targets = [];
			for (let target of event.targets) {
				if (
					target.getHistory("damage", function (evt) {
						return evt.card == card;
					}).length == 0 &&
					target.countDiscardableCards(player, "he") > 0
				) {
					targets.push(target);
				}
			}
			if (targets.length) {
				let result = await player.chooseTarget(targets, true).forResult();
				if (result.bool) {
					await player.discardPlayerCard(result.target, true, "he", 3);
				}
			}
		},
	},
	qj_chuitong: {
		trigger: {
			global: "dying",
		},
		filter(event, player) {
			if (event.player != player) {
				return false;
			}
			var cards = event.target.getCards("e");
			for (var i of cards) {
				if (player.canEquip(i)) {
					return true;
				}
			}
			return false;
		},
		logTarget: "player",
		frequent: true,
		preHidden: true,
		async cost(event, trigger, player) {
			var cards = event.target.getCards("e");
			for (var i of cards) {
				if (player.canEquip(i)) {
					list.push(i);
				}
			}
			if (list.length) {
				event.result = await player
					.choosePlayerCard(target, "e", get.prompt("reqieting", target))
					.set("list", list)
					.set("filterButton", function (button) {
						return _status.event.list.includes(button.link);
					})
					.set("ai", function (button) {
						var evt = _status.event,
							val = get.value(button.link);
						if (evt.target.hasSkillTag("noe")) {
							val -= 4;
						}
						if (evt.att > 0 == val > 0) {
							return 0;
						}
						return get.effect(evt.player, button.link, evt.player, evt.player);
					})
					.set("att", get.attitude(player, target))
					.forResult();
			}
		},
		async content(event, trigger, player) {
			player.logSkill("reqieting", target);
			var card = event.links[0];
			event.player.$give(card, player, false);
			game.delay(0.5);
			player.equip(card);
		},
		ai: {
			expose: 0.5,
		},
	},
	qj_xingtu: {
		trigger: {
			global: "phaseJieshuBegin",
		},
		frequent: true,
		preHidden: true,
		filter(event, player, name) {
			return (
				game.countPlayer2(function (current) {
					current.getHistory("useCard", function (evt) {
						get.is.yingbian(evt.card);
					});
				}) > 0
			);
		},
		async cost(event, trigger, player) {
			if (player.countCards("hes", card => get.type(card) == "equip").length == 0) {
				event.result = { index: 1 };
			} else {
				event.result = await player
					.chooseControl()
					.set("choiceList", ["将一张装备牌当【桃】对一名角色使用", "摸一张牌"])
					.set("ai", function () {
						if (
							game.countPlayer(function (current) {
								current.isFriendOf(player) && current.hp <= 1;
							}) > 0
						) {
							return 0;
						}
						if (
							game.countPlayer(function (current) {
								current.isFriendOf(player) && current.isDamaged();
							}) > 0
						) {
							return Math.random() > 0.5 ? 1 : 0;
						}
						return 1;
					})
					.forResult();
			}
		},
		async content(event, trigger, player) {
			if (event.index == 0) {
				let result = await player
					.chooseCardTarget({
						position: "hes",
						filterCard(card, player) {
							return get.type(card) == "equip";
						},
						selectCard: 1,
						filterTarget(player, target) {
							return target.isDamaged();
						},
						ai1(card) {
							return 6 - get.value(card);
						},
						ai2(target) {
							const player = get.player();
							if (get.attitude(player, _status.currentPhase) < 0) {
								return -1;
							}
							const att = get.attitude(player, target);
							if (target == player && player.hp <= 1) {
								return 4;
							}
							return att + 4 - target.hp;
						},
						prompt: get.prompt2("将一张装备牌当【桃】对一名角色使用"),
					})
					.forResult();
				if (result.bool) {
					var cards = result.cards;
					var cardx = get.autoViewAs({ name: "tao" }, cards);
					var targets = result.targets.filter(targetx => {
						return player.canUse(cardx, targetx);
					});
					if (targets.length) {
						player.useCard(cardx, cards, targets);
					}
				}
			} else {
				await player.draw();
			}
		},
	},
	qj_tairan: {
		audio: "tairan",
		trigger: { player: "phaseUseBegin" },
		preHidden: true,
		check(event, player) {
			return (
				player.isDamaged() &&
				player.hasCard(function (card) {
					return 5.5 - get.value(card);
				}, "he")
			);
		},
		async cost(event, trigger, player) {
			var list = [],
				num = 0;
			if (
				player.isHealthy() ||
				!player.hasCard(function (card) {
					return lib.filter.cardDiscardable(card, player, "qj_tairan");
				}, "he")
			) {
				num = 1;
			}
			event.num = num;
			for (var i = num; i <= player.hp; i++) {
				list.push(i + "点");
			}
			await player.chooseControl(list).set("prompt", "###请先失去任意点体力###此回合结束时，你将恢复等量的体力");
		},
		async content(event, trigger, player) {
			var num1 = event.index + num;
			event.num1 = num1;
			if (num1 > 0) {
				await player.loseHp(num1);
			}
			if (
				player.isDamaged() &&
				player.hasCard(function (card) {
					return lib.filter.cardDiscardable(card, player, "qj_tairan");
				}, "he")
			) {
				var next = await player.chooseToDiscard("he", [1, player.getDamagedHp()], "然后请弃置任意张牌", "此回合结束时，你将摸等量的牌。").set("ai", function (card) {
					return 5.5 - get.value(card);
				});
				if (event.num1 == 0) {
					await next.set("forced", true);
				}
			}
			var num2 = 0;
			if (event.bool) {
				num2 = result.cards.length;
			}
			var storage = [event.num1, num2];
			player.addTempSkill("qj_tairan_effect");
			player.storage.qj_tairan_effect = storage;
		},
		subSkill: {
			effect: {
				audio: "tairan",
				trigger: { player: "phaseEnd" },
				filter(event, player) {
					var storage = player.storage.qj_tairan_effect;
					return storage && storage.length == 2 && (storage[1] > 0 || player.isDamaged());
				},
				forced: true,
				charlotte: true,
				onremove: true,
				async content(event, trigger, player) {
					var storage = player.storage.qj_tairan_effect;
					if (storage[0] > 0) {
						await player.recover(storage[0]);
					}
					if (storage[1] > 0) {
						await player.draw(storage[1]);
					}
				},
			},
		},
	},
	qj_yimie: {
		audio: "yimie",
		filter(event, player) {
			return player.hp <= event.player.hp && event.num > 0;
		},
		limited: true,
		preHidden: true,
		trigger: {
			source: "damageBegin1",
		},
		check(event, player) {
			return (
				get.attitude(player, event.player) < 0 &&
				!event.player.hasSkillTag("filterDamage", null, {
					player: player,
					card: event.card,
				})
			);
		},
		logTarget: "player",
		async content(event, trigger, player) {
			trigger.num *= 2;
		},
	},
	qj_choufa: {
		audio: "choufa",
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return game.hasPlayer(function (current) {
				return lib.skill.choufa.filterTarget(null, player, current);
			});
		},
		filterTarget(card, player, target) {
			return target != player && !target.hasSkill("qj_choufa_effct") && target.countCards("h") > 0;
		},
		async content(event, trigger, player) {
			let target = event.target;
			let result = await player.choosePlayerCard(target, "h", true).forResult();
			await player.showCards(result.cards, get.translation(player) + "对" + get.translation(target) + "发动了【筹伐】");
			var type = get.type2(result.cards[0], target),
				hs = target.getCards("h", function (card) {
					return card != result.cards[0] && get.type2(card, target) != type;
				});
			if (hs.length) {
				target.addGaintag(hs, "sha_qj_choufa");
				target.addTempSkill("qj_choufa_effct");
			}
		},
		ai: {
			order: 9,
			result: {
				target(player, target) {
					return -target.countCards("h");
				},
			},
		},
		subSkill: {
			effect: {
				charlotte: true,
				onremove(player) {
					player.removeGaintag("sha_qj_choufa");
				},
				mod: {
					cardname(card) {
						if (get.itemtype(card) == "card" && card.hasGaintag("sha_qj_choufa")) {
							return "sha";
						}
					},
					cardnature(card) {
						if (get.itemtype(card) == "card" && card.hasGaintag("sha_qj_choufa")) {
							return false;
						}
					},
				},
			},
		},
	},
	qj_zhaoran: {
		audio: "zhaoran",
		trigger: { player: "phaseUseBegin" },
		preHidden: true,
		async content(event, trigger, player) {
			player.addTempSkill("qj_zhaoran_2", "phaseUseAfter");
			var cards = player.getCards("h");
			if (cards.length > 0) {
				player.addShownCards(cards, "visible_qj_zhaoran");
			}
		},
		subSkill: {
			2: {
				audio: "zhaoran",
				group: "qj_zhaoran_3",
				sourceSkill: "qj_zhaoran",
				init: (player, skill) => {
					if (!player.storage[skill]) {
						player.storage[skill] = [];
					}
				},
				onremove: true,
				trigger: {
					player: "loseAfter",
					global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
				},
				forced: true,
				charlotte: true,
				popup: false,
				filter(event, player, name) {
					if (name == "gainBegin") {
						return true;
					}
					var evt = event.getl(player);
					if (!evt || !evt.hs || !evt.hs.length) {
						return false;
					}
					var list = player.getStorage("qj_zhaoran_2");
					for (var i of evt.hs) {
						var suit = get.suit(i, player);
						if (!list.includes(suit) && !player.countCards("h", { suit: suit })) {
							return true;
						}
					}
					return false;
				},
				filterTarget(card, player, target) {
					return target != player && target.countDiscardableCards(player, "he") > 0;
				},
				async content(event, trigger, player) {
					if (trigger.delay === false) {
						await game.delayx();
					}
					var list = [];
					var suits = get.copy(player.storage.qj_zhaoran_2);
					suits.addArray(
						player.getCards("h").map(function (card) {
							return get.suit(card);
						})
					);
					var evt = trigger.getl(player);
					for (var i of evt.hs) {
						var suit = get.suit(i, player);
						if (!suits.includes(suit)) {
							list.add(suit);
						}
					}
					await player.markAuto("qj_zhaoran_2", list);
					for (let suit in list) {
						if (
							!game.hasPlayer(function (suit) {
								return lib.skill.qj_zhaoran_2.filterTarget(null, player, suit);
							})
						) {
							event.bool = false;
						} else {
							let result = await player
								.chooseTarget(lib.skill.qj_zhaoran_2.filterTarget, "弃置一名其他角色的一张牌或摸一张牌")
								.set("ai", function (target = event.target) {
									var att = get.attitude(player, target);
									if (att >= 0) {
										return 0;
									}
									if (
										target.countCards("he", function (card) {
											return get.value(card) > 5;
										})
									) {
										return -att;
									}
									return 0;
								})
								.forResult();
							if (result.bool) {
								var target = result.targets[0];
								player.logSkill("qj_zhaoran_2", target);
								player.discardPlayerCard(target, true, "he");
							} else {
								player.logSkill("qj_zhaoran_2");
								player.draw();
							}
						}
					}
				},
				intro: {
					content: "已因$牌触发过效果",
				},
			},
			3: {
				trigger: { player: ["phaseUseEnd", "gainBegin"] },
				forced: true,
				charlotte: true,
				firstDo: true,
				silent: true,
				sourceSkill: "qj_zhaoran",
				async content(event, trigger, player) {
					if (event.triggername == "gainBegin") {
						trigger.gaintag.add("visible_qj_zhaoran");
					} else {
						player.hideShownCards(player.getCards("h"), "visible_qj_zhaoran");
					}
				},
			},
		},
	},
	qj_tongfa: {
		trigger: { global: "yingbian" },
		filter(event, player) {
			return get.is.yingbianConditional(event.card) && event.player.isFriendOf(player) && event.player.countCards("he") > 0;
		},
		async content(event, trigger, player) {
			let str = "一张牌";
			if (trigger.player == player) {
				str = "弃";
			} else {
				str = "交给" + get.translation(player) + str;
			}
			str += "以触发应变。";
			let result = await trigger.player.chooseCard("he", str).forResult();
			if (trigger.player == player) {
				await player.discard(result.cards);
			} else {
				await trigger.player.give(result.cards, player);
			}
			trigger.forceYingbian = true;
		},
	},
	qj_beishi: {
		trigger: {
			target: "useCardToTarget",
		},
		preHidden: true,
		filter(event, player) {
			if (event.player == player) {
				return false;
			}
			if (event.card.name == "tao" || event.card.name == "jiu" || event.card.name == "taoyuan" || event.card.name == "lianjunshengyan") {
				return false;
			}
			if (event.targets && event.targets.length > 1) {
				return false;
			}
			if (player.countCards("he", card => get.type(card) == get.type(event.card)) == 0) {
				return false;
			}
			return true;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCard("he", "请弃置一张类别相同的牌")
				.set("filterCard", card => get.type(card) == get.type(trigger.card))
				.forResult();
		},
		async content(event, trigger, player) {
			await player.discard(event.cards);
			await trigger.getParent()?.targets.remove(player);
			if (trigger.cards.filterInD().length) {
				await player.gain(trigger.cards.filterInD(), "gain2");
				if (trigger.card.isCard && trigger.cards.length == 1) {
					let card = trigger.cards[0];
					if (player.canUse(card, trigger.player, false)) {
						await player.useCard(card, trigger.player, false);
						if (player.getHistory("sourceDamage", evt => evt.card == card)) {
							return;
						}
					}
				}
			}
			await player.loseHp();
		},
	},
	qj_rouke: {
		trigger: {
			global: "useCard1",
		},
		filter(event, player) {
			if (event.player.isFriendOf(player) && event.card.name == "sha") {
				if (player.getHistory("useCard").filter(card => card.name == "sha").length == 0 && !player.hasMark("qj_rouke_used")) {
					player.markAuto("qj_rouke_used", 1);
					player.addTempSkill("qj_rouke_used", "phaseAfter");
					return true;
				}
			}
			return false;
		},
		async content(event, trigger, player) {
			game.log(player, "将", trigger.card, "改为了冰属性");
			game.setNature(trigger.card, "ice");
			trigger.player.addTempSkill("qj_rouke_link");
		},
		mod: {
			maxHandcardBase(player, num) {
				return num + game.countPlayer(cur => cur.isLinked());
			},
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
			link: {
				trigger: {
					global: "useCardAfter",
				},
				direct: true,
				filter(event, player) {
					return !game.hasPlayer2(target => {
						return target.getHistory("damage", evt => evt.card && evt.card == event.card).length > 0;
					});
				},
				async content(event, trigger, player) {
					let result = await player
						.chooseTarget("你可以令至多两名角色横置或重置", [1, 2])
						.set("ai", target => {
							return get.effect(target, { name: "tiesuo" }, player, player);
						})
						.setHiddenSkill(event.skill)
						.forResult();
					if (result.bool && result.targets.length) {
						for (let target of result.targets) {
							target.link();
						}
					}
					player.removeSkill("qj_rouke_link");
				},
			},
		},
	},
	qj_shunliu: {
		trigger: {
			source: "damageAfter",
		},
		logTarget: "player",
		preHidden: true,
		filter(event, player) {
			return event.hasNature("linked") && game.countPlayer(cur => cur.isLinked() && cur.countCards("he"));
		},
		check(event, player) {
			return game.countPlayer(cur => cur.isLinked() && get.attitude(player, cur) < 0) > game.countPlayer(cur => cur.isLinked() && get.attitude(player, cur) > 0);
		},
		async content(event, trigger, player) {
			let targets = game.players.filter(current => current.isLinked());
			for (let target of targets) {
				if (target.countCards("he")) {
					await player.discardPlayerCard(target, "he", true);
				}
			}
		},
	},
	qj_shiren: {
		audio: "yanxi",
		trigger: {
			player: "phaseZhunbeiBegin",
		},
		preHidden: true,
		filter(event, player) {
			return game.hasPlayer(current => !player.isFriendOf(current) && current.countCards("h"));
		},
		preHidden: true,
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), [1, 3], (card, player, target) => {
					return !player.isFriendOf(target) && target.countCards("h");
				})
				.set("ai", target => {
					const att = get.attitude(get.player(), target);
					return -att;
				})
				.setHiddenSkill(event.skill)
				.forResult();
		},
		async content(event, trigger, player) {
			const cards = [],
				targets = event.targets.sortBySeat();
			for (const target of targets) {
				const result = await player.choosePlayerCard(target, "h", true).forResult();
				if (result?.bool && result.cards?.length) {
					cards.addArray(result.cards);
				}
			}
			const names = [];
			for (const target of targets) {
				const prompt = `识人：声明一个牌名（你被选择的牌为${get.translation(cards[targets.indexOf(target)])}）`;
				const result = await target
					.chooseButton([prompt, [get.inpileVCardList(i => !i[3]), "vcard"]], true)
					.set("ai", button => {
						const { player, chosenCard: card } = get.event();
						if (Math.random() > 0.5 && button.link[2] == card.name) {
							return 24;
						}
						return player.countCards("h", button.link[2]);
					})
					.set("chosenCard", cards[targets.indexOf(target)])
					.forResult();
				if (result?.bool && result.links?.length) {
					names.push(result.links[0][2]);
					target.chat(get.translation(result.links[0][2]));
					game.log(target, "声明了", `#y${get.translation(result.links[0][2])}`);
				}
			}
			const result = await player
				.chooseTarget(
					"识人：展示并获得一名角色被你选择的牌",
					(card, player, target) => {
						return get.event("targetx").includes(target);
					},
					true
				)
				.set("targetx", targets)
				.set("ai", target => Math.random())
				.forResult();
			if (result?.bool) {
				const target = result.targets[0],
					index = targets.indexOf(target),
					card = cards[index],
					name = names[index];
				await target.showCards([card]);
				await target.give(card, player, true);
				if (name != card.name) {
					await player.gain(
						cards.filter(cardx => cardx != card),
						"giveAuto"
					);
				}
			}
		},
	},
	qj_jiexia: {
		audio: "shiren",
		trigger: {
			global: "damageEnd",
		},
		filter(event, player) {
			if (player.hasSkill("qj_jiexia_used")) {
				return false;
			}
			let num1 = 0,
				num2 = 0;
			if (!player.isUnseen(0) && !player.name1.startsWith("gz_shibing") && !lib.character[player.name1].isShibing) {
				num1++;
			}
			if (!player.isUnseen(1) && !player.name2.startsWith("gz_shibing") && !lib.character[player.name2].isShibing) {
				num1++;
			}
			if (!event.player.isUnseen(0) && !event.player.name1.startsWith("gz_shibing") && !lib.character[event.player.name1].isShibing) {
				num2++;
			}
			if (!event.player.isUnseen(1) && !event.player.name2.startsWith("gz_shibing") && !lib.character[event.player.name2].isShibing) {
				num2++;
			}
			return event.player != player && num1 > num2 && event.player.isIn() && player.countCards("he") > 1;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCardTarget({
					filterCard: true,
					prompt: get.prompt2(event.skill, trigger.player),
					position: "he",
					selectCard: 2,
					filterTarget(card, player, target) {
						return target == get.event("targetx");
					},
					targetx: trigger.player,
					selectTarget: -1,
					ai1(card) {
						const { player, targetx: target } = get.event();
						if (get.attitude(player, target) <= 0) {
							return 0;
						}
						return 8 - get.value(card);
					},
					ai2() {
						return 1;
					},
				})
				.setHiddenSkill(event.skill)
				.forResult();
		},
		preHidden: true,
		async content(event, trigger, player) {
			await player.give(event.cards, event.targets[0]);
			await player.draw(2);
			player.addTempSkill("qj_jiexia_used", "phaseJieshuAfter");
		},
		subSkill: {
			used: {
				charlotte: true,
			},
		},
	},
	qj_yishi: {
		audio: "jyishi",
		trigger: { global: ["loseAfter", "loseAsyncAfter"] },
		usable: 1,
		preHidden: true,
		filter(event, player) {
			const target = event.player;
			if (!target || !target.isIn() || event.type != "discard" || !player.isFriendOf(target) || event.discarder != target || !event.cards2 || !event.cards2.length) {
				return false;
			}
			return true;
		},
		async cost(event, trigger, player) {
			const target = trigger.player,
				cards = trigger.cards2.filterInD("d");
			if (cards.length == 0) {
				return;
			}
			event.cards = cards;
			let str = "是否发动【宜室】令" + get.translation(target) + "获得其中一张牌";
			if (cards.length > 1) {
				str += "，然后获得其余一张牌";
			}
			str += "？";
			const {
				result: { bool, links },
			} = await player
				.chooseButton([str, cards])
				.set("ai", button => {
					const card = button.link;
					const { player, source } = get.event();
					if (get.attitude(player, source) > 0) {
						return Math.max(1, source.getUseValue(card, null, true));
					}
					const cards = get.event().getParent().cards.slice(0);
					if (cards.length == 1) {
						return -get.value(card);
					}
					cards.remove(card);
					return get.value(cards) - get.value(card) - 2;
				})
				.set("source", target)
				.setHiddenSkill(event.skill);
			event.result = {
				bool: bool,
				targets: [target],
				cost_data: links,
			};
		},
		async content(event, trigger, player) {
			const {
					targets: [target],
					cost_data: links,
				} = event,
				cards = trigger.cards2.filterInD("d");
			await target.gain(links, "gain2");
			cards.remove(links[0]);
			if (cards.length) {
				const result = await player
					.chooseCardButton("选择获得其中一张牌", true, cards, 1)
					.set("ai", function (button) {
						return get.value(button.link, player);
					})
					.forResult();
				if (result.bool && result?.links) {
					const links = result.links;
					if (links.length) {
						await player.gain(links, "gain2");
					}
				}
			}
		},
	},
	qj_shidu: {
		audio: "shiduo",
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return game.hasPlayer(function (target) {
				return player != target && player.canCompare(target);
			});
		},
		filterTarget(card, player, target) {
			return player != target && player.canCompare(target);
		},
		async content(event, trigger, player) {
			let result = await player.chooseToCompare(event.target).forResult();
			if (result.bool && event.target.isAlive()) {
				var num = event.target.countCards("h");
				if (num > 0) {
					await player.gainPlayerCard(event.target, true, "h", num);
				}
			} else {
				return;
			}
			var num = Math.floor(player.countCards("h") / 2);
			if (num && event.target.isAlive()) {
				result = await player.chooseCard("h", num, true, "交给" + get.translation(event.target) + get.cnNumber(num) + "张牌").forResult();
			} else {
				return;
			}
			if (result.bool && result.cards && result.cards.length) {
				await player.give(result.cards, event.target);
			}
		},
		ai: {
			order: 1,
			result: {
				target(player, target) {
					var delta = target.countCards("h") - player.countCards("h");
					if (delta < 0) {
						return 0;
					}
					return -1 - delta;
				},
			},
		},
	},
	qj_quanbian: {
		trigger: {
			global: "useCard",
		},
		preHidden: true,
		filter(event, player) {
			if (event.player != player || !player.isPhaseUsing()) {
				return false;
			}
			if (
				!event.player.getHistory("lose", function (evt) {
					return (evt.relatedEvent || evt.getParent()) == event && evt.hs && evt.hs.length == event.cards.length;
				}).length
			) {
				return false;
			}
			if (player.hasMark("qj_quanbian_used")) {
				let suits = player.getStorage("qj_quanbian_used");
				if (suits.includes(get.suit(event.card))) {
					return false;
				}
			}
			player.markAuto("qj_quanbian_used", get.suit(event.card));
			return true;
		},
		check(event, player) {
			var cards = player.getCards("h").filter(card => (get.suit(card) == get.suit(event.card) && player.hasUseTarget(card, null, card.name === "sha")) || (get.info(card).notarget && lib.filter.cardEnabled(card, player)));
			switch (cards.length) {
				case 0:
					return 1;
				case 1:
					return Math.random() < 0.5;
				case 2:
					return Math.random() < 0.2;
				default:
					return 0;
			}
		},
		async content(event, trigger, player) {
			await player.markAuto("qj_quanbian_effect", get.suit(trigger.card));
			await player.addTempSkill("qj_quanbian_effect", "phaseUseAfter");
			await player.chooseToGuanxing(3);
			await player.draw(1);
		},
		subSkill: {
			effect: {
				charlotte: true,
				onremove: true,
				mod: {
					cardEnabled(card, player) {
						const suits = player.getStorage("qj_quanbian_effect");
						if (get.position(card) == "h" && suits && suits.includes(get.suit(card))) {
							return false;
						}
						return true;
					},
				},
			},
			used: {
				charlotte: true,
				onremove: true,
			},
		},
	},
	qj_zhouting: {
		audio: "xiongzhi",
		enable: "phaseUse",
		limited: true,
		skillAnimation: true,
		animationColor: "thunder",
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			let i = 0;
			while (true) {
				i++;
				const card = get.cards()[0];
				await game.cardsGotoOrdering(card);
				await player.showCards(card);
				let result = await player.chooseUseTarget(card, "是否使用" + get.translation(card) + "？", false, false).forResult();
				if (!result?.bool || i >= game.countPlayer()) {
					break;
				}
			}
		},
		ai: {
			order: 1,
			result: {
				player(player) {
					return 1;
				},
			},
		},
	},
	qj_shangshi: {
		audio: "shangshi",
		trigger: { global: "phaseJieshuBegin" },
		frequent: true,
		preHidden: true,
		filter(event, player) {
			return event.player.countCards("h") > player.countCards("h") || player.countCards("h") < player.getDamagedHp();
		},
		async cost(event, trigger, player) {
			if (!player.isDamaged()) {
				event.result = { index: 0 };
			} else if (event.player.countCards("h") <= player.countCards("h")) {
				event.result = { index: 1 };
			} else {
				event.result = await target
					.chooseControl()
					.set("choiceList", ["将任意张牌当【杀】对当前回合角色使用", "摸牌至你已损失的体力值"])
					.set("ai", function () {
						if (get.attitude(player, event.player) > 0 || player.countCards("h") == 0) {
							return 1;
						}
						return 0;
					})
					.forResult();
			}
		},
		async content(event, trigger, player) {
			if (event.index == 0) {
				let result = await player.chooseCard("h", [1, Infinity], "将任意张牌当【杀】对" + get.translation(trigger.player) + "使用").forResult();
				if (result.bool) {
					var cards = result.cards;
					var cardx = get.autoViewAs({ name: "sha" }, cards);
					var target = trigger.player;
					player.useCard(cardx, cards, target);
				}
			} else if (event.index == 1) {
				let num = player.getDamagedHp() - player.countCards("h");
				if (num > 0) {
					await player.draw(num);
				}
			}
		},
	},
	qj_ejue: {
		audio: "jueqing",
		filter(event, player) {
			return player.countCards("h") == 0;
		},
		preHidden: true,
		trigger: {
			source: "damageBegin1",
		},
		check(event, player) {
			return (
				get.attitude(player, event.player) < 0 &&
				!event.player.hasSkillTag("filterDamage", null, {
					player: player,
					card: event.card,
				})
			);
		},
		logTarget: "player",
		async cost(event, trigger, player) {
			let choiceList = ownedSkills.map(skill => {
				return `<div class="skill">【${get.translation(lib.translate[skill + "_ab"] || get.translation(skill).slice(0, 2))}】</div><div>${get.skillInfoTranslation(skill, target)}</div>`;
			});
			if (player.hasMark("zhulianbihe_mark")) {
				choiceList.push("珠联璧合");
			}
			event.result = await target
				.chooseControl(ownedSkills)
				.set("choiceList", choiceList)
				.set("displayIndex", false)
				.set("prompt", "扼绝：选择失去一个技能或珠联璧合标记")
				.set("ai", () => {
					return get.event("choice");
				})
				.set(
					"choice",
					(() => {
						const uselessSkills = ownedSkills.filter(skill => {
							const info = get.info(skill);
							if (!info) {
								return false;
							}
							if (target.awakenedSkills.includes(skill) && (info.limited || info.juexingji || info.dutySkill)) {
								return true;
							}
							if (info.ai && (info.ai.neg || info.ai.halfneg)) {
								return true;
							}
							return false;
						});
						if (uselessSkills.length) {
							return uselessSkills.randomGet();
						}
						if (player.hasMark("zhulianbihe_mark")) {
							return "珠联璧合";
						}
						return ownedSkills.sort((a, b) => {
							return get.skillRank(a, "inout") - get.skillRank(b, "inout");
						})[0];
					})()
				)
				.forResult();
		},
		async content(event, trigger, player) {
			if (event.control == "珠联璧合") {
				await player.removeMark("zhulianbihe_mark");
			} else {
				await player.removeSkills(event.control);
			}
			trigger.num *= 2;
			trigger.nature = "ice";
		},
	},
	qj_guoyi: {
		audio: "xijue",
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			if (player.countCards("h", card => get.type(card) == "basic").length == 0) {
				return false;
			}
			return game.hasPlayer(current => current.countCards("he"));
		},
		filterCard(card) {
			return get.type(card) == "basic";
		},
		position: "h",
		filterTarget(card, player, target) {
			if (target == player) {
				return false;
			}
			return target.countCards("he") > 0;
		},
		selectCard() {
			return [1, 3];
		},
		filterOk() {
			return ui.selected.cards.length === ui.selected.targets.length;
		},
		async content(event, trigger, player) {
			await player.discard(event.cards);
			let controls = [];
			for (let target of event.targets) {
				let control;
				if (target.countCards("e") == 0 && player.countCards("h") > 0) {
					control = "选项二";
				} else if (player.countCards("h") == 0 && target.countCards("e") > 0) {
					control = "选项一";
				} else if (player.countCards("h") > 0 && target.countCards("e") > 0) {
					control = await target
						.chooseControl("选项一", "选项二")
						.set("choiceList", [`令${get.translation(player)}弃置你装备区一张牌`, `令${get.translation(player)}获得你的一张手牌`])
						.set("prompt", "果毅：请选择一项")
						.set("ai", () => {
							return get.event("choice");
						})
						.set(
							"choice",
							(() => {
								if (controls.length == 1) {
									if (controls[0] == "选项一") {
										return get.attitude(player, target) < 0 ? "选项一" : "选项二";
									}
									return get.attitude(player, target) < 0 ? "选项二" : "选项一";
								}
								if (target.countCards("h") > 3 || get.attitude(player, target) > 0) {
									return "选项二";
								}
								return Math.random() < 0.5 ? "选项一" : "选项二";
							})()
						)
						.forResultControl();
				}
				if (!control) {
					continue;
				}
				if (!controls.includes(control)) {
					controls.push(control);
				}
				if (result.control == "选项一") {
					await player.discardPlayerCard(target, "h", true);
				} else {
					await player.gainPlayerCard(target, true, "h");
				}
			}
			if (controls.length == 2) {
				let result = await player
					.chooseTarget("是否对其中一名角色造成1点伤害？", function (card, player, target) {
						return event.targets.includes(target);
					})
					.set("ai", function (target) {
						return -get.attitude(player, target);
					})
					.forResult();
				if (result.bool) {
					await player.damage(result.targets[0]);
				}
			}
		},
	},
	qj_ciwei: {
		init: () => {
			game.addGlobalSkill("qj_ciwei_ai");
		},
		onremove: () => {
			if (!game.hasPlayer(i => i.hasSkill("qj_ciwei", null, null, false), true)) {
				game.removeGlobalSkill("qj_ciwei_ai");
			}
		},
		audio: "ciwei",
		trigger: { global: "useCard" },
		preHidden: true,
		filter(event, player) {
			if (event.player != _status.currentPhase || !player.countCards("he")) {
				return false;
			}
			return event.player.getHistory("useCard").indexOf(event) == 1;
		},
		check(event, player) {
			return ["basic", "trick"].includes(get.type(event.card));
		},
		async cost(event, trigger, player) {
			if (player != game.me && !player.isOnline()) {
				game.delayx();
			}
			let str = "弃置一张牌，";
			if (["basic", "trick"].includes(get.type(trigger.card))) {
				str += get.translation(trigger.card) + "对任意目标无效。";
			} else {
				str += "令" + get.translation(trigger.player) + "横置。";
			}
			event.result = await player
				.chooseToDiscard(get.prompt("qj_ciwei", trigger.player), str, "he")
				.set("ai", function (card) {
					if(get.type(trigger.card)=="equip"){
						return -1;
					}
					return _status.event.goon / 1.4 - get.value(card);
				})
				.set(
					"goon",
					(function () {
						if (!trigger.targets.length) {
							return -get.attitude(player, trigger.player);
						}
						var num = 0;
						for (var i of trigger.targets) {
							num -= get.effect(i, trigger.card, trigger.player, player);
						}
						return num;
					})()
				)
				.setHiddenSkill(event.name)
				.forResult();
		},
		async content(event, trigger, player) {
			if (["basic", "trick"].includes(get.type(trigger.card))) {
				let result = await player
					.chooseTarget(get.prompt("qj_ciwei"), [1, Infinity], function (card, player, target) {
						return _status.event.targets.includes(target);
					})
					.set("ai", function (target) {
						return -get.effect(target, trigger.card, trigger.player, _status.event.player);
					})
					.set("targets", trigger.targets)
					.forResult();
				if (result.bool) {
					player.logSkill("qj_ciwei", result.targets);
					trigger.excluded.addArray(result.targets);
				}
			} else {
				player.logSkill("qj_ciwei", _status.currentPhase);
				_status.currentPhase.link(true);
			}
		},
		subSkill: {
			ai: {
				mod: {
					aiOrder(player, card, num) {
						if (
							player != _status.currentPhase ||
							player.getHistory("useCard").length > 1 ||
							!game.hasPlayer(function (current) {
								return current != player && (get.realAttitude || get.attitude)(current, player) < 0 && current.hasSkill("ciwei") && current.countCards("he") > 0;
							})
						) {
							return;
						}
						if (player.getHistory("useCard").length == 0) {
							if (["basic", "trick"].includes(get.type(card))) {
								return num + 10;
							}
							return;
						}
						if (!["basic", "trick"].includes(get.type(card))) {
							return num + 10;
						}
						if (!player._ciwei_temp) {
							player._ciwei_temp = true;
							num /= Math.max(1, player.getUseValue(card));
						}
						delete player._ciwei_temp;
						return num;
					},
				},
				trigger: { player: "dieAfter" },
				sourceSkill: "ciwei",
				filter: () => {
					return !game.hasPlayer(i => i.hasSkill("ciwei", null, null, false), true);
				},
				silent: true,
				forceDie: true,
				content: () => {
					game.removeGlobalSkill("ciwei_ai");
				},
			},
		},
	},
	qj_caiyuan: {
		trigger: {
			global: "phaseJieshuBegin",
		},
		preHidden: true,
		forced: true,
		locked: true,
		filter(event, player, name) {
			return event.player.isFriendOf(player) && (event.player.isDamaged() || event.player.isLinked());
		},
		async content(event, trigger, player) {
			if (trigger.player.isDamaged()) {
				trigger.player.draw();
			}
			if (trigger.player.isLinked()) {
				trigger.player.link(false);
				trigger.player.draw();
			}
		},
	},
	qj_chengliu: {
		trigger: { player: "yingbian" },
		forced: true,
		filter(event, player) {
			return get.tag(event.card, "damage");
		},
		async content(event, trigger, player) {
			const forced = (function (trigger, player) {
				if (trigger.forceYingbian || player.hasSkillTag("forceYingbian")) {
					return true;
				}
				const list = trigger.temporaryYingbian || [];
				return list.includes("force") || get.cardtag(trigger.card, "yingbian_force");
			})(trigger, player);
			const goon = lib.yingbian.condition.simple.get("fujia")(trigger);
			let color = forced ? lib.yingbian.condition.color.get("force") : "thunder";
			if (forced || goon) {
				player.popup("yingbian_force_tag", color);
				game.log(player, "触发了", "#g【乘流】", "为", trigger.card, "添加的应变条件（", "#g改为雷电伤害）");
				await game.yingbianEffect(trigger, () => {
					game.setNature(trigger.card, "thunder");
					trigger.player.markAuto("qj_chengliu_nature", trigger.card);
					trigger.player.addTempSkill("qj_chengliu_nature", "damageAfter");
				});
			}
			player.addTempSkill("qj_chengliu_link");
		},
		subSkill: {
			nature: {
				trigger: { global: "damageBegin1" },
				forced: true,
				charlotte: true,
				sourceSkill: "qj_chengliu",
				onremove: true,
				filter(event, player) {
					if (!event.card || event.hasNature("thunder")) {
						return false;
					}
					if (player.storage.qj_chengliu_cards && player.storage.qj_chengliu_cards.includes(event.card)) {
						return true;
					}
					return false;
				},
				async content(event, trigger, player) {
					game.setNature(trigger, "thunder");
					if (player.storage.qj_chengliu_cards) {
						let index = player.storage.qj_chengliu_cards.indexOf(trigger.card);
						if (index >= 0) {
							player.storage.qj_chengliu_cards.splice(index, 1);
						}
						if (player.storage.qj_chengliu_cards.length == 0) {
							delete player.storage.qj_chengliu_cards;
							player.removeSkill("qj_chengliu_nature");
						}
					}
				},
			},
			link: {
				charlotte: true,
				direct: true,
				trigger: { player: "useCardAfter" },
				filter(event, player) {
					return game.hasPlayer(current => current.hasHistory("damage", evt => evt.card == event.card));
				},
				async content(event, trigger, player) {
					const damagedTargets = game.filterPlayer(current => current.hasHistory("damage", evt => evt.card == trigger.card) && !current.isLinked());
					if (damagedTargets.length > 0) {
						let result = await player
							.chooseTarget([0, damagedTargets.length], "选择要横置的角色", (card, player, target) => damagedTargets.includes(target) && !target.isLinked())
							.set("ai", target => {
								return get.effect(target, { name: "tiesuo" }, player, player);
							})
							.forResult();
						if (result.bool && result.targets.length) {
							player.line(result.targets, "green");
							for (const target of result.targets) {
								if (!target.isLinked()) {
									target.link();
								}
							}
						}
					}
					player.removeSkill("qj_chengliu_link");
				},
			},
		},
	},
	qj_keqing: {
		enable: "phaseUse",
		usable: 1,
		group: "qj_keqing_remove",
		filterTarget(card, player, target) {
			return target != player && target.isLinked() && target.isIn();
		},
		async content(event, trigger, player) {
			if (player.storage.qj_keqing_target) {
				const oldTarget = player.storage.qj_keqing_target;
				if (oldTarget.isAlive() && oldTarget.hasSkill("qj_keqing_effect")) {
					oldTarget.removeSkill("qj_keqing_effect");
				}
				delete player.storage.qj_keqing_target;
			}
			if (event.targets.length > 0) {
				const target = event.targets[0];
				player.storage.qj_keqing_target = target;
				target.addTempSkill("qj_keqing_effect");
				player.logSkill("qj_keqing", target);
			}
		},
		subSkill: {
			effect: {
				onremove: true,
				trigger: { player: ["useCard", "respond"] },
				filter(event, player) {
					return player.isLinked() && player.countCards("he") > 0;
				},
				forced: true,
				async content(event, trigger, player) {
					if (player.countCards("he") > 0) {
						const result = await player.chooseToDiscard("弃置一张牌", "he", 1, true).forResult();
						if (result.bool && result.cards.length > 0) {
							player.discard(result.cards);
						}
					}
				},
				sourceSkill: "qj_keqing",
			},
			remove: {
				charlotte: true,
				trigger: { player: "die" },
				filter(event, player) {
					return player.storage && player.storage.qj_keqing_target;
				},
				forced: true,
				content(event, trigger, player) {
					if (player.storage && player.storage.qj_keqing_target) {
						const target = player.storage.qj_keqing_target;
						if (target.isAlive() && target.hasSkill("qj_keqing_effect")) {
							target.removeSkill("qj_keqing_effect");
						}
						delete player.storage.qj_keqing_target;
					}
				},
				sourceSkill: "qj_keqing",
			},
		},
	},
	qj_lvli: {
		trigger: {
			source: "damageSource",
		},
		filter(event, player) {
			return event.num > 0 && !player.hasSkill("qj_lvli_used");
		},
		preHidden: true,
		async cost(event, trigger, player) {
			let result = await player
				.chooseControl("选项一", "选项二", "cancel2")
				.set("choiceList", [`摸牌至体力值`, `弃置所有手牌，然后回复体力至X点（X为以此法弃置的牌数）。`])
				.set("prompt", "膂力：请选择一项")
				.set("ai", () => {
					return get.event("choice");
				})
				.set(
					"choice",
					(() => {
						if (player.hp > player.countCards("h")) {
							return "选项一";
						}
						let discard = player.countCards("h");
						let recover = Math.min(player.maxHp, discard) - player.hp;
						if (recover * 2 >= discard) {
							return "选项二";
						}
						return "cancel2";
					})()
				)
				.forResult();
			event.result = {
				bool: result.control != "cancel2",
				cost_data: result.control,
			};
		},
		async content(event, trigger, player) {
			const { cost_data: control } = event;
			if (control == "选项一") {
				let num = player.hp - player.countCards("h");
				if (num > 0) {
					await player.draw(num);
				}
			} else if (control == "选项二") {
				let discard = player.getCards("h");
				await player.discard(player.getCards("h"));
				let recover = Math.min(player.maxHp, discard) - player.hp;
				if (recover > 0) {
					await player.recover(recover);
				}
			}
			player.addTempSkill("qj_lvli_used");
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
		},
	},
	qj_duoqi: {
		trigger: { global: "phaseAfter" },
		limited: true,
		preHidden: true,
		filter(event, player) {
			return event.player.countCards("h") == 0 || player.countCards("h") == 0;
		},
		async content(event, trigger, player) {
			player.insertPhase();
		},
	},
	qj_qianqu: {
		preHidden: true,
		trigger: { global: "phaseZhunbeiBegin" },
		filter(event, player) {
			return event.player.isFriendOf(player) && player.hasSha();
		},
		async cost(event, trigger, player) {
			player.addTempSkill("qj_qianqu_yingbian", "useCardAfter");
			event.result = await player
				.chooseToUse(function (card, player, event) {
					if (get.name(card) != "sha") {
						return false;
					}
					return lib.filter.filterCard.apply(this, arguments);
				}, "前驱：是否使用一张【杀】<助战→弃置目标角色装备区里的一张牌>？")
				.set("targetRequired", true)
				.set("complexSelect", true)
				.set("filterTarget", function (card, player, target) {
					return lib.filter.targetEnabled.apply(this, arguments);
				})
				.set("logSkill", event.name)
				.set("addCount", false)
				.forResult();
		},
		async content(event, trigger, player) {
			var bool = game.hasPlayer2(function (current) {
				return (
					current.getHistory("damage", function (evt) {
						return evt.getParent("qj_qianqu") == event;
					}).length > 0
				);
			});
			if (bool) {
				trigger.player.gain(event.cards, "gain2");
				trigger.player.draw();
			}
		},
		subSkill: {
			yingbian: {
				charlotte: true,
				onremove: true,
				forced: true,
				trigger: { player: "yingbian" },
				async content(event, trigger, player) {
					const forced = (function (trigger, player) {
						if (trigger.forceYingbian || player.hasSkillTag("forceYingbian")) {
							return true;
						}
						const list = trigger.temporaryYingbian || [];
						return list.includes("force") || get.cardtag(trigger.card, "yingbian_force");
					})(trigger, player);
					let goon = false;
					if (!forced) {
						const { result } = await lib.yingbian.condition.complex.get("zhuzhan")(trigger);
						goon = result?.bool;
					}
					if (forced || goon) {
						game.log(player, "触发了", "#g【前驱】", "为", trigger.card, "添加的应变条件（", "#g弃置目标角色装备区里的一张牌）");
						await game.yingbianEffect(trigger, () => {
							trigger.player.addTempSkill("qj_qianqu_discard", "useCardAfter");
						});
					}
				},
			},
		},
		discard: {
			trigger: { global: "damageBegin1" },
			forced: true,
			charlotte: true,
			sourceSkill: "qj_qianqu",
			onremove: true,
			trigger: { player: "useCardToPlayered" },
			filter(event, player) {
				return event.target.countDiscardableCards(player, "e") > 0;
			},
			preHidden: true,
			logTarget: "target",
			async content(event, trigger, player) {
				await player.discardPlayerCard(trigger.target, "弃置目标角色的一张装备牌", "e", true);
			},
		},
	},
	qj_fuli: {
		preHidden: true,
		trigger: { global: "phaseDrawBegin2" },
		filter(event, player) {
			return event.player.isFriendOf(player) && !event.numFixed;
		},
		async content(event, trigger, player) {
			trigger.num++;
			player.addTempSkill("qj_fuli_give", "phaseDrawAfter");
		},
		subSkill: {
			give: {
				trigger: { global: "phaseDrawEnd" },
				forced: true,
				charlotte: true,
				filter(event, player) {
					return event.player.countCards("h") > 0 && player.isIn();
				},
				async content(event, trigger, player) {
					let result = await trigger.player
						.chooseCard("h", "展示并交给" + get.translation(player) + "一张手牌，本回合不能使用或打出该花色的牌。", true)
						.set("ai", function (card) {
							return -get.value(card);
						})
						.forResult();
					if (result.bool && result.cards && result.cards.length) {
						await trigger.player.showCards(result.cards);
						if (trigger.player != player) {
							await trigger.player.give(result.cards, player);
						}
						let suits = [];
						for (let card of result.cards) {
							let suit = get.suit(card);
							if (!suits.includes(suit)) {
								suits.push(suit);
							}
						}
						trigger.player.addTempSkill("qj_fuli_forbid", "phaseEnd");
						trigger.player.markAuto("qj_fuli_forbid", suits);
					}
				},
			},
			forbid: {
				charlotte: true,
				onremove: true,
				mod: {
					cardEnabled2(card, player) {
						if (get.itemtype(card) == "card" && player.getStorage("qj_fuli_forbid").some(suit => suit == get.suit(card))) {
							return false;
						}
					},
				},
				mark: true,
				intro: {
					content: "本回合不能使用或打出$花色的手牌",
				},
			},
		},
	},
	qj_fengwu: {
		enable: "phaseUse",
		usable: 1,
		filterTarget(card, player, target) {
			return target.isIn();
		},
		selectTarget: [1, 3],
		multitarget: true,
		async content(event, trigger, player) {
			for (let i in event.targets) {
				await event.targets[i].chooseToUse("【风物】：是否使用一张牌？", false, false).set("addCount", false);
			}
			let suits = [];
			for (let evt of game.getGlobalHistory("everything", evt => evt.name === "useCard")) {
				if (evt.card && get.suit(evt.card) && !suits.includes(get.suit(evt.card))) {
					suits.push(get.suit(evt.card));
				}
			}
			const allSuits = ["spade", "heart", "club", "diamond"];
			const allInArray = allSuits.every(element => suits.includes(element));
			if (allInArray) {
				await player.draw(2);
				await player.recover();
			}
		},
	},
	qj_tianming: {
		audio: "tianming",
		preHidden: true,
		trigger: { target: "useCardToTargeted" },
		check(event, player) {
			var cards = player.getCards("h");
			if (cards.length <= 2) {
				for (var i = 0; i < cards.length; i++) {
					if (cards[i].name == "shan" || cards[i].name == "tao") {
						return false;
					}
				}
			}
			return true;
		},
		filter(event, player) {
			return event.card.name == "sha";
		},
		async content(event, trigger, player) {
			player.chooseToDiscard(2, true, "he");
			player.draw(2);
		},
		ai: {
			effect: {
				target_use(card, player, target, current) {
					if (card.name == "sha") {
						return [1, 0.5];
					}
				},
			},
		},
	},
	qj_mizhao: {
		enable: "phaseUse",
		usable: 1,
		audio: "mizhao",
		filter(event, player) {
			return player.countCards("h") >= game.countGroup() - 1 && game.countGroup() > 1;
		},
		filterCard: true,
		selectCard: -1,
		filterTarget(card, player, target) {
			return player != target;
		},
		discard: false,
		lose: false,
		delay: false,
		async content(event, trigger, player) {
			let num = game.countGroup() - 1;
			player.chooseCardTarget({
				selectCard: num,
				filterTarget: lib.filter.notMe,
				prompt: "是否交给一名其他角色牌？",
				position: "he",
				ai1(card) {
					var player = _status.event.player;
					if (player.maxHp - player.hp == 1 && card.name == "du") {
						return 30;
					}
					var check = player.countCards("h") - num;
					if (check < 1) {
						return 0;
					}
					if (player.hp > 1 && check < num) {
						return 0;
					}
					return get.unuseful(card) + 9;
				},
				ai2(target) {
					var att = get.attitude(_status.event.player, target);
					if (ui.selected.cards.length == 1 && ui.selected.cards[0].name == "du") {
						return 1 - att;
					}
					return att - 2;
				},
			});
			if (event.result.bool) {
				player.give(event.cards, event.targets[0]);
			}
			if (!event.targets[0].countCards("h")) {
				event.finish();
				return;
			}
			var players = game.filterPlayer();
			for (var i = 0; i < players.length; i++) {
				if (players[i] != event.target1 && players[i] != player && event.target1.canCompare(players[i])) {
					break;
				}
			}
			if (i == players.length) {
				return;
			}
			await player
				.chooseTarget(true, "选择拼点目标", function (card, player, target) {
					return _status.event.target1.canCompare(target) && target != player;
				})
				.set("ai", function (target = event.target) {
					var player = _status.event.player;
					var eff = get.effect(target, { name: "sha" }, _status.event.target1, player);
					var att = get.attitude(player, target);
					if (att > 0) {
						return eff - 10;
					}
					return eff;
				})
				.set("target1", event.target1)
				.set("forceDie", true);
			if (result.targets.length) {
				event.target2 = result.targets[0];
				await event.target1.line(event.target2);
				await event.target1.chooseToCompare(event.target2);
			} else {
				return;
			}
			if (!result.tie) {
				if (result.bool) {
					if (event.target1.canUse({ name: "sha", isCard: true }, event.target2, false)) {
						await event.target1.useCard({ name: "sha", isCard: true }, event.target2);
					}
				} else if (event.target2.canUse({ name: "sha", isCard: true }, event.target1, false)) {
					await event.target2.useCard({ name: "sha", isCard: true }, event.target1);
				}
			}
		},
	},
	qj_shiyuan: {
		audio: "shiyuan",
		trigger: { target: "useCardToTargeted" },
		frequent: true,
		preHidden: true,
		filter(event, player) {
			var num = 1;
			return (
				player != event.player &&
				player.getHistory("gain", function (evt) {
					return evt.getParent(2).name == "qj_shiyuan" && evt.cards.length == evt.player.hp > player.hp ? 2 : 1;
				}).length < num
			);
		},
		async content(event, trigger, player) {
			if (trigger.player.hp > player.hp) {
				player.draw(2);
			} else {
				player.draw(1);
			}
		},
		ai: {
			effect: {
				target_use(card, player, target) {
					if (get.itemtype(player) !== "player" || player === target) {
						return 1;
					}
					let num = 1,
						ds = 2 + get.sgn(player.hp - target.hp);
					if (
						target.getHistory("gain", function (evt) {
							return evt.getParent(2).name === "qj_shiyuan" && evt.cards.length === ds;
						}).length >= num
					) {
						return 1;
					}
					let name = get.name(card);
					if (get.tag(card, "lose") || name === "huogong" || name === "juedou" || name === "tiesuo") {
						return [1, ds];
					}
					if (!target.hasFriend()) {
						return 1;
					}
					return [1, 0.5 * ds];
				},
			},
		},
	},
	qj_dushi: {
		audio: "dushi",
		global: "qj_dushi_2",
		locked: true,
		trigger: { player: "die" },
		forceDie: true,
		filter(event, player) {
			return event.source && event.source.isIn();
		},
		async content(event, trigger, player) {
			player.logSkill("qj_dushi", event.source);
			target.markSkill("qj_dushi");
			target.addSkills("qj_dushi");
		},
		intro: { content: "您已经获得弘农王的诅咒" },
		subSkill: {
			2: {
				mod: {
					cardSavable(card, player, target) {
						if (card.name == "tao" && target != player && target.hasSkill("qj_dushi")) {
							return false;
						}
					},
				},
			},
		},
	},
	qj_taoluan: {
		audio: "taoluan",
		enable: ["chooseToUse", "chooseToRespond"],
		filter(event, player) {
			let bool = false;
			if (player.isUnseen(0) && lib.character[player.name1][3].includes("qj_taoluan")) {
				bool = true;
			}
			if (player.isUnseen(1) && lib.character[player.name2][3].includes("qj_taoluan")) {
				bool = true;
			}
			if (!bool) {
				return false;
			}
			for (let i of lib.inpile) {
				let type = get.type2(i);
				if ((type == "basic" || type == "trick") && event.filterCard(get.autoViewAs({ name: i }, "unsure"), player, event)) {
					return true;
				}
			}
			return false;
		},
		chooseButton: {
			dialog(event, player) {
				let list = [];
				for (let i = 0; i < lib.inpile.length; i++) {
					let name = lib.inpile[i];
					if (name == "sha") {
						if (event.filterCard(get.autoViewAs({ name }, "unsure"), player, event)) {
							list.push(["基本", "", "sha"]);
						}
						for (let nature of lib.inpile_nature) {
							if (event.filterCard(get.autoViewAs({ name, nature }, "unsure"), player, event)) {
								list.push(["基本", "", "sha", nature]);
							}
						}
					} else if (get.type2(name) == "trick" && event.filterCard(get.autoViewAs({ name }, "unsure"), player, event)) {
						list.push(["锦囊", "", name]);
					} else if (get.type(name) == "basic" && event.filterCard(get.autoViewAs({ name }, "unsure"), player, event)) {
						list.push(["基本", "", name]);
					}
				}
				return ui.create.dialog("滔乱", [list, "vcard"]);
			},
			check(button) {
				if (_status.event.getParent().type != "phase") {
					return 1;
				}
				let player = _status.event.player;
				if (["wugu", "zhulu_card", "yiyi", "lulitongxin", "lianjunshengyan", "diaohulishan"].includes(button.link[2])) {
					return 0;
				}
				return player.getUseValue({
					name: button.link[2],
					nature: button.link[3],
				});
			},
			backup(links, player) {
				return {
					filterCard: () => false,
					selectCard: -1,
					audio: "taoluan",
					popname: true,
					check(card) {
						return 8 - get.value(card);
					},
					viewAs: { name: links[0][2], nature: links[0][3] },
					onuse(result, player) {
						if (!player.hasSkill("qj_taoluan_used")) {
							player.addTempSkill("qj_taoluan_used");
						}
						player.markAuto("qj_taoluan_used", result.targets);
					},
				};
			},
			prompt(links, player) {
				return "明置此武将，视为使用" + (get.translation(links[0][3]) || "") + get.translation(links[0][2]);
			},
		},
		ai: { mingzhi_no: true },
		subSkill: {
			used: {
				charlotte: true,

				trigger: {
					global: "phaseEnd",
				},
				forced: true,
				onremove: true,
				popup: false,
				filter(event, player, name) {
					return player.hasMark("qj_taoluan_used") && player.getStorage("qj_taoluan_used").length > 0;
				},
				async content(event, trigger, player) {
					let targets = player.getStorage("qj_taoluan_used");
					let result = await player
						.chooseTarget(true, "选择至多三名其他角色，令其依次展示并交给你一张手牌，若其中的红色牌多于黑色牌，你暗置一张武将牌。", [1, targets.length], function (card, player, target) {
							return targets.includes(target) && target.countCards("h") > 0 && target != player;
						})
						.set("ai", function (target) {
							let friend = false;
							for (t of targets) {
								if (t.isFriendOf(player) && t.countCards("h") >= 3) {
									friend = true;
								}
							}
							if (friend) {
								if (get.attitude(player, target) <= 0) {
									return 0;
								}
								return t.countCards("h");
							} else {
								return -get.attitude(player, target);
							}
						})
						.set("targets", targets)
						.forResult();
					let cards = [];
					for (let target of result.targets) {
						let result1 = await target
							.chooseCard("h", "交给" + get.translation(player) + "一张手牌", true)
							.set("ai", function (card) {
								if (get.attitude(player, target) > 0) {
									return get.color(card) == "red";
								} else {
									if (get.color(card) == "black") {
										return 6 - get.value(card);
									}
								}
								return 0;
							})
							.forResult();
						if (result1.bool && result1.cards && result1.cards.length) {
							await target.showCards(result1.cards);
							await target.give(result1.cards, player);
							cards.push(...result1.cards);
						}
					}
					let red = 0;
					let black = 0;
					for (let card of cards) {
						if (get.color(card) == "red") {
							red++;
						} else if (get.color(card) == "black") {
							black++;
						}
					}
					if (red > black) {
						const controls = [];
						if (!player.isUnseen(0) && !get.is.jun(player) && player.hasMainCharacter()) {
							controls.push("主将");
						}
						if (!player.isUnseen(1) && player.hasViceCharacter()) {
							controls.push("副将");
						}
						let result = null;
						if (controls.length == 1) {
							result = { control: controls[0] };
						} else if (controls.length > 1) {
							result = await player
								.chooseControl(controls)
								.set("ai", () => {
									if (get.character(player.name, 3).includes("qj_taoluan")) {
										return "主将";
									}
									return "副将";
								})
								.set("prompt", `请选择一个武将暗置。`)
								.forResult();
						}
						if (result.control) {
							player.hideCharacter(result.control == "主将" ? 0 : 1);
						}
					}
				},
			},
			backup: {
				audio: "taoluan",
			},
		},
	},
	qj_mouzhu: {
		audio: "mouzhu",
		enable: "phaseUse",
		usable: 1,
		filterTarget(card, player, target) {
			return target != player && target.countCards("h") > 0;
		},
		async content(event, trigger, player) {
			let target = event.target;
			let result = await target.chooseCard("h", "交给" + get.translation(player) + "一张手牌", true).forResult();
			if (result.bool) {
				await target.give(result.cards, player);
			}
			if (player.countCards("h") <= target.countCards("h")) {
				return;
			}
			var list = [];
			if (target.hasUseTarget({ name: "sha" })) {
				list.push("sha");
			}
			if (target.hasUseTarget({ name: "sha" })) {
				list.push("juedou");
			}
			let result2;
			if (!list.length) {
				return;
			} else if (list.length == 1) {
				result2 = { control: list[0] };
			} else {
				result2 = await target
					.chooseControl(list)
					.set("prompt", "谋诛：视为使用一张【杀】或【决斗】")
					.set("ai", function () {
						var player = _status.event.player;
						return player.getUseValue({ name: "sha" }) > player.getUseValue({ name: "juedou" }) ? "sha" : "juedou";
					})
					.forResult();
			}
			if (result2.control) {
				await target.chooseUseTarget({ name: result2.control }, true);
			}
		},
		ai: {
			order: 7,
			result: {
				target(player, target) {
					if (
						get.attitude(target, player) > 0 &&
						game.hasPlayer(function (current) {
							if (current == target) {
								return false;
							}
							for (var card of [{ name: "sha" }, { name: "juedou" }]) {
								if (target.canUse(card, current) && get.effect(current, card, target, player) > 0 && get.effect(current, card, target, target) > 0) {
									return true;
								}
							}
							return false;
						}) &&
						target.countCards("h") < player.countCards("h") + 2
					) {
						return 3;
					}
					if (!target.hasValueTarget({ name: "sha" }) && !target.hasValueTarget({ name: "juedou" })) {
						return -2;
					}
					if (target.countCards("h") + 1 > player.countCards("h")) {
						return -2;
					}
					var canSave = function (player, target) {
						return target.hp + player.countCards("hs", card => player.canSaveCard(card, target)) > 1 + ((get.mode() == "identity" && target.identity == "zhu") || (get.mode() == "guozhan" && get.is.jun(target)));
					};
					if (target.hasValueTarget({ name: "sha" })) {
						var aimx = game
							.filterPlayer(current => {
								return target.canUse({ name: "sha" }, current) && get.effect(current, { name: "sha" }, target, target) > 0;
							})
							.sort((a, b) => get.effect(b, { name: "sha" }, target, target) - get.effect(a, { name: "sha" }, target, target))[0];
						if (aimx && get.effect(aimx, { name: "sha" }, target, player) < 0 && get.effect(aimx, { name: "sha" }, target, aimx) < 0 && !canSave(player, aimx)) {
							return 0;
						}
					}
					if (target.hasValueTarget({ name: "juedou" })) {
						var aimy = game
							.filterPlayer(current => {
								return target.canUse({ name: "juedou" }, current) && get.effect(current, { name: "juedou" }, target, target) > 0;
							})
							.sort((a, b) => get.effect(b, { name: "juedou" }, target, target) - get.effect(a, { name: "juedou" }, target, target))[0];
						if (aimy && get.effect(aimy, { name: "juedou" }, target, player) < 0 && get.effect(aimy, { name: "sha" }, target, aimy) < 0 && !canSave(player, aimy)) {
							return 0;
						}
					}
					return -1;
				},
			},
		},
	},
	qj_gounan: {
		audio: "yanhuo",
		trigger: { player: "die" },
		forceDie: true,
		skillAnimation: true,
		animationColor: "soil",
		filter(event, player) {
			return event.source;
		},
		async content(event, trigger, player) {
			player.line(
				game.players.filterPlayer(current => current.isFriendOf(trigger.source) || current.isFriendOf(player)),
				"green"
			);
			game.addGlobalSkill("qj_gounan_damage");
			game.addGlobalSkill("qj_gounan_remove");
			game.broadcastAll(() => {
				if (!_status.qj_gounan) {
					_status.qj_gounan = 0;
					_status.qj_gounan_group1 = [];
					_status.qj_gounan_group2 = [];
				}
				_status.qj_gounan++;
				_status.qj_gounan_group1.push(player.identity);
				_status.qj_gounan_group2.push(trigger.source.identity);
			});
		},
		subSkill: {
			damage: {
				trigger: { player: "useCard" },
				forced: true,
				filter(event, player) {
					return event.card.name == "sha" && _status.qj_gounan_group1.includes(event.source.identity) && _status.qj_gounan_group1.includes(event.player.identity);
				},
				async content(event, trigger, player) {
					trigger.baseDamage += _status.qj_gounan || 0;
				},
			},
			remove: {
				trigger: { player: "phaseBegin" },
				forced: true,
				charlotte: true,
				silent: true,
				onremove: true,
				filter: true,
				async content(event, trigger, player) {
					game.removeGlobalSkill("qj_gounan_damage");
					trigger.player.removeSkill("qj_gounan_remove");
				},
			},
		},
	},
	qj_lianji: {
		audio: "lianji",
		enable: "phaseUse",
		usable: 1,
		filterCard: true,
		filterTarget(card, player, target) {
			if (target == player) {
				return false;
			}
			var stat = player.getStat()._qj_lianji;
			return !stat || !stat.includes(target);
		},
		filter(event, player) {
			return game.hasPlayer(current => lib.skill.qj_lianji.filterTarget(null, player, current));
		},
		check(card) {
			return 7 - get.value(card);
		},
		lose: false,
		discard: false,
		delay: false,
		async content(event, trigger, player) {
			var stat = player.getStat();
			if (!stat._qj_lianji) {
				stat._qj_lianji = [];
			}
			stat._qj_lianji.push(event.target);
			const cards = event.cards,
				target = event.target;
			await player.give(cards, target);
			await target.addTempSkill("qj_lianji_effect");
			await target.addMark("qj_lianji_effect", 1, false);
			await game.delayx();
		},
		ai: {
			order: 1,
			result: {
				target(player, target) {
					return get.value(card);
				},
			},
		},
		subSkill: {
			effect: {
				charlotte: true,
				onremove: true,
				trigger: {
					player: "damageBegin1",
				},
				forced: true,
				async content(event, trigger, player) {
					trigger.num += player.countMark(event.name);
					player.removeSkill(event.name);
				},
				sourceSkill: "qj_lianji",
			},
		},
	},
	qj_dingzhu: {
		preHidden: true,
		trigger: {
			player: "phaseUseEnd",
		},
		filter(event, player) {
			return game.hasPlayer(current => current.getHistory("gain").length && current != player && current.hasUseTarget({ name: "juedou" }));
		},
		filterTarget: function (card, player, target) {
			return target != player && target.getHistory("gain").length && target.hasUseTarget({ name: "juedou" });
		},
		async content(event, trigger, player) {
			await event.target.chooseUseTarget({ name: "juedou" }, true);
		},
	},
	qj_minsi: {
		audio: "minsi",
		enable: "phaseUse",
		getResult(cards) {
			var l = cards.length;
			var all = Math.pow(l, 2);
			var list = [];
			for (var i = 1; i < all; i++) {
				var array = [];
				for (var j = 0; j < l; j++) {
					if (Math.floor((i % Math.pow(2, j + 1)) / Math.pow(2, j)) > 0) {
						array.push(cards[j]);
					}
				}
				var num = 0;
				for (var k of array) {
					num += get.number(k);
				}
				if (num == 13) {
					list.push(array);
				}
			}
			if (list.length) {
				list.sort(function (a, b) {
					if (a.length != b.length) {
						return b.length - a.length;
					}
					return get.value(a) - get.value(b);
				});
				return list[0];
			}
			return list;
		},
		usable: 1,
		filterCard(card) {
			if (ui.selected.cards.length >= 3) {
				return false;
			}
			var num = 0;
			for (var i = 0; i < ui.selected.cards.length; i++) {
				num += get.number(ui.selected.cards[i]);
			}
			return get.number(card) + num <= 13;
		},
		complexCard: true,
		selectCard() {
			var num = 0;
			for (var i = 0; i < ui.selected.cards.length; i++) {
				num += get.number(ui.selected.cards[i]);
			}
			if (num == 13) {
				return ui.selected.cards.length;
			}
			return ui.selected.cards.length + 2;
		},
		check(card) {
			var evt = _status.event;
			if (!evt.qj_minsi_choice) {
				evt.qj_minsi_choice = lib.skill.minsi.getResult(evt.player.getCards("he"));
			}
			if (!evt.qj_minsi_choice.includes(card)) {
				return 0;
			}
			return 1;
		},
		position: "he",
		async content(event, trigger, player) {
			let cards = get.cards(event.cards.length * 2);
			await game.cardsGotoOrdering(cards);
			await player.showCards(cards);
			cards.gaintag = ["heart_qj_minsi"];
			player.addTempSkill("heart_qj_minsi");
			await player.gain(cards, "gain2");
			game.delay();
		},
		ai: {
			order: 5,
			result: { player: 1 },
		},
		subSkill: {
			2: {
				onremove(player) {
					player.removeGaintag("heart_qj_minsi");
				},
				mod: {
					ignoredHandcard(card, player) {
						if (card.hasGaintag("heart_qj_minsi") && get.suit(card) == "heart") {
							return true;
						}
					},
					cardDiscardable(card, player, name) {
						if (name == "phaseDiscard" && card.hasGaintag("heart_qj_minsi") && get.suit(card) == "heart") {
							return false;
						}
					},
				},
			},
		},
	},
	qj_fusong: {
		audio: "fusong",
		trigger: { player: "die" },
		forceDie: true,
		filter(event, player) {
			if (
				game.hasPlayer(current => {
					return current != player && current.isFriendOf(player);
				})
			) {
				return false;
			}
			return !player.hasCard(card => get.suit(card) == "heart", "he");
		},
		async cost(event, trigger, player) {
			await player
				.chooseTarget(get.prompt2("qj_minsi"), function (card, player, target) {
					return target != player && target.isFriendOf(player);
				})
				.set("forceDie", true)
				.set("ai", function (target) {
					var num = get.attitude(_status.event.player, target);
					if (num > 0) {
						if (target.hp == 1) {
							num += 2;
						}
						if (target.hp < target.maxHp) {
							num += 2;
						}
					}
					return num;
				})
				.set("sourcex", trigger.source);
		},
		async content(event, trigger, player) {
			event.togain = [];
			for (let card in player.getCards("he")) {
				if (get.suit(card) == "heart") {
					event.togain.push(card);
				}
			}
			event.target.gain(event.togain, player, "giveAuto");
			event.target.draw(event.togain.length);
		},
	},
	qj_zhuikong: {
		audio: "zhuikong",
		trigger: { global: "phaseZhunbeiBegin" },
		preHidden: true,
		check(event, player) {
			if (get.attitude(player, event.player) < -2) {
				var cards = player.getCards("h");
				if (cards.length > player.hp) {
					return true;
				}
				for (var i = 0; i < cards.length; i++) {
					var useful = get.useful(cards[i]);
					if (useful < 5) {
						return true;
					}
					if (get.number(cards[i]) > 9 && useful < 7) {
						return true;
					}
				}
			}
			return false;
		},
		logTarget: "player",
		filter(event, player) {
			return player.hp < player.maxHp && player.canCompare(event.player);
		},
		async content(event, trigger, player) {
			await player.chooseToCompare(trigger.player);
			if (event.bool) {
				trigger.player.addTempSkill("qj_zhuikong_prevent");
			} else {
				const sha = get.autoViewAs({ name: "sha", isCard: true });
				if (!trigger.player.canUse(sha, player, false)) {
					return;
				}
				const bool = await target
					.chooseBool("惴恐", `是否视为对${get.translation(player)}使用一张【杀】？`)
					.set("choice", get.effect(player, sha, target, target) > 0)
					.forResultBool();
				if (bool) {
					await target.useCard(sha, player, false);
				}
			}
		},
		subSkill: {
			prevent: {
				trigger: {
					source: "damageBegin2",
				},
				forced: true,
				sourceSkill: "qj_zhuikong",
				filter(event, player) {
					if (event.name == "damage") {
						return true;
					}
				},
				popup: false,
				async content(event, trigger, player) {
					if (trigger.name == "damage") {
						player.logSkill("qj_zhuikong", trigger.player);
						trigger.cancel();
						event.finish();
						return;
					}
				},
				ai: {
					effect: {
						player(card, player, target) {
							if (get.tag(card, "damage")) {
								return "zeroplayertarget";
							}
						},
					},
				},
			},
		},
	},
	qj_qiuyuan: {
		audio: "qiuyuan",
		trigger: { target: "useCardToTarget" },
		preHidden: true,
		filter(event, player) {
			return (
				event.card.name == "sha" &&
				game.hasPlayer(current => {
					return current != player && !event.targets.includes(current) && lib.filter.targetEnabled(event.card, event.player, current);
				})
			);
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), (card, player, target) => {
					const evt = get.event().getTrigger();
					return target != player && !evt.targets.includes(target) && lib.filter.targetEnabled(evt.card, evt.player, target);
				})
				.set("ai", target => {
					const evt = get.event().getTrigger();
					const player = get.player();
					return get.effect(target, evt.card, evt.player, player) + 0.1;
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			trigger.getParent().targets = [target, ...trigger.targets];
			trigger.getParent().triggeredTargets2 = [target, ...trigger.targets];
			game.log(target, "成为了【杀】的额外目标");
			trigger.targets.addArray([target, ...trigger.targets]);
			event.player.addTempSkill(event.name + "_trigger");
			event.player.markAuto(event.name + "_trigger", [trigger.card]);
		},
		subSkill: {
			trigger: {
				trigger: {
					player: ["shaMiss", "useCardAfter", "useCardCancelled"],
				},
				filter(event, player) {
					return player.getStorage("qj_qiuyuan_trigger").includes(event.card);
				},
				silent: true,
				onremove: true,
				charlotte: true,
				async content(event, trigger, player) {
					if (event.triggername === "shaMiss" && player.getStorage(event.name).includes(trigger.card)) {
						trigger.getParent().excluded.addArray(trigger.getParent().targets);
					} else {
						player.unmarkAuto(event.name, [trigger.card]);
					}
				},
			},
		},
	},
	qj_moukui: {
		audio: "moukui",
		preHidden: true,
		trigger: { player: "useCardToPlayered" },
		filter(event, player) {
			return event.card.name == "sha";
		},
		async cost(event, trigger, player) {
			const controls = ["draw_card"];
			if (trigger.target.countCards("he")) {
				controls.push("discard_card");
			}
			controls.push("cancel");
			const result = await player
				.chooseControl(controls)
				.set("ai", function () {
					var trigger = _status.event.getTrigger(),
						player = _status.event.player;
					if (trigger.target.countCards("he") && get.attitude(_status.event.player, trigger.target) < 0) {
						return "discard_card";
					}
					const num = Math.min(player.getCardUsable("sha"), player.countCards("hs", i => get.name(i) === "sha") + 1);
					if (!player.hasCard(i => get.value(i) > 6 + num, "e")) {
						return "draw_card";
					}
					return "cancel";
				})
				.set("prompt", get.prompt2(event.skill, trigger.target))
				.forResult();
			event.result = {
				bool: result.control != "cancel",
				targets: [trigger.target],
				cost_data: result.control,
			};
		},
		async content(event, trigger, player) {
			const result = event.cost_data;
			if (result == "draw_card") {
				await player.draw();
			} else if (trigger.target.countCards("he")) {
				await player.discardPlayerCard(trigger.target, "he", true);
			}
			player.markAuto("qj_moukui_2", trigger.target);
		},
		group: "qj_moukui_2",
		ai: {
			expose: 0.1,
		},
		subSkill: {
			2: {
				audio: false,
				trigger: { player: "shaMiss" },
				forced: true,
				sourceSkill: "qj_moukui",
				onremove: true,
				filter(event, player) {
					if (!player.getStorage("qj_moukui_2").includes(event.target)) {
						return false;
					}
					return player.countCards("he") > 0;
				},
				async content(event, trigger, player) {
					trigger.target.line(player, "green");
					trigger.target.discardPlayerCard(player, true);
					player.unmarkAuto("qj_moukui_2", [trigger.target]);
				},
			},
		},
	},
	qj_chengzhao: {
		audio: "chengzhao",
		preHidden: true,
		trigger: { global: "phaseJieshuBegin" },
		filter(event, player) {
			var num = 0;
			player.getHistory("gain", function (evt) {
				num += evt.cards.length;
			});
			if (num < 2) {
				return false;
			}
			return (
				player.countCards("h") > 0 &&
				game.hasPlayer(function (current) {
					return player != current && player.canCompare(current);
				})
			);
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2("qj_chengzhao"), function (card, player, target) {
					return player.canCompare(target);
				})
				.set("ai", function (target) {
					return -get.attitude(_status.event.player, target) / target.countCards("h");
				})
				.forResult();
		},
		async content(event, trigger, player) {
			var target = event.targets[0];
			player.logSkill("qj_chengzhao", target);
			let result = await player.chooseToCompare(target);
			if (result.bool) {
				var card = { name: "sha", isCard: true };
				if (player.canUse(card, target, false)) {
					player.useCard(card, target, false).card.qj_chengzhao = true;
				}
			}
		},
		ai: {
			unequip: true,
			skillTagFilter(player, tag, arg) {
				if (!arg || !arg.card || arg.card.qj_chengzhao != true) {
					return false;
				}
			},
		},
	},
	qj_aiwu: {
		trigger: { global: "damageEnd" },
		filter(event, player) {
			return event.num > 0 && event.player != player && !player.hasSkill("qj_aiwu_used");
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseToDiscard("he", "你可以弃置至少一张牌，然后" + get.translation(trigger.player) + "可以弃置至少一张牌，若你与其共计弃置的牌数达到三张，你与其各回复1点体力", [1, Infinity])
				.set("ai", function (card) {
					if(get.attitude(player, trigger.player) < 2 || !player.isDamaged() && !trigger.player.isFriendOf(player)){
						return -1;
					}
					if (!trigger.player.isFriendOf(player)) {
						return ui.selected.targets.length > 0 ? -1 : 7 - get.value(card);
					}
					const h1 = player.countCards("he");
					const h2 = trigger.player.countCards("he");
					const maxTargets = h1 < h2 ? -1 : h2 === 0 || h1 - h2 > 2 ? 2 : 1;
					return ui.selected.targets.length > maxTargets ? -1 : 7 - get.value(card);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			player.addTempSkill("qj_aiwu_used", "phaseEnd");
			let result2 = await trigger.player
				.chooseToDiscard("he", get.translation(player) + "弃置了" + event.cards.length + "张牌，你可以弃置至少一张牌，若你与其共计弃置的牌数达到三张，你与其各回复1点体力", [1, Infinity])
				.set("ai", function (card) {
					if (event.cards.length == 1) {
						return ui.selected.targets.length > 1 ? -1 : 10 - get.value(card);
					}
					return ui.selected.targets.length > 0 ? -1 : 10 - get.value(card);
				})
				.set(
					"goon",
					(function () {
						if (event.cards.length >= 3) {
							return 0;
						}
						return get.attitude(trigger.player, player);
					})()
				)
				.forResult();
			let length2 = 0;
			if (result2.bool) {
				length2 = result2.cards.length;
			}
			if (length2 + event.cards.length >= 3) {
				player.line(trigger.player, "green");
				player.recover();
				trigger.player.recover();
			}
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
		},
	},
	qj_juebie: {
		trigger: {
			global: "die",
		},
		filter(event, player) {
			return event.player.isFriendOf(player);
		},
		preHidden: true,
		forceDie: true,
		async cost(event, trigger, player) {
			event.result = await trigger.player
				.chooseTarget(get.prompt2("qj_juebie"), function (card, player, target) {
					return target.isFriendOf(player);
				})
				.set("ai", function (target) {
					return get.attitude(trigger.player, target);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			var choice = ["摸三张牌"];
			if (trigger.player.countCards("he")) {
				choice.push("获得牌");
			}
			choice.push("cancel2");
			let target = event.targets[0];
			let result = await trigger.player
				.chooseControl(choice)
				.set("prompt", "请选择令" + get.translation(target) + "获得你的所有牌或摸三张牌")
				.set("ai", function () {
					if (choice.length == 2) {
						return 0;
					}
					if (get.value(trigger.player.getCards("he")) > 8) {
						return 1;
					}
					return 0;
				});
			if (result.control != "cancel2") {
				trigger.player.logSkill(event.name, target);
				if (result.control == "获得牌") {
					event.togain = trigger.player.getCards("he");
					target.gain(event.togain, trigger.player, "giveAuto", "bySelf");
				} else {
					target.draw(3);
				}
			}
		},
	},
	qj_zhudian: {
		trigger: { target: "useCardToTargeted" },
		filter(event, player) {
			return event.player != player && get.color(event.card) == "black";
		},
		logTarget: "player",
		check(event, player) {
			return player.countCards("he") > 0 && get.color(event.card);
		},
		preHidden: true,
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCard("he", "你可以重铸一张牌，然后若你摸到的牌为" + (get.suit(event.card) == "spade" ? "草花" : "黑桃") + "，你可以展示之并额外摸一张牌")
				.set("ai", function (card) {
					return 7 - get.value(card);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			let card = await player.recast(event.cards[0]);
			let suit = "";
			if (get.suit(event.card) == "spade") {
				suit = "club";
			} else if (get.suit(event.card) == "club") {
				suit = "spade";
			}
			if (get.suit(card) == suit) {
				player.showCard(card);
				player.draw();
			}
		},
	},
	qj_botong: {
		group: "qj_botong_after",
		hiddenCard(player, name) {
			return get.type(name) == "basic" && lib.inpile.includes(name) && player.countCards("hes") >= 4;
		},
		enable: "chooseToUse",
		filter(event, player) {
			if (event.type == "wuxie") {
				return false;
			}
			if (player.countCards("hes") < 4) {
				return false;
			}
			return get
				.inpileVCardList(info => {
					const name = info[2];
					return get.type(name) == "basic";
				})
				.some(card => event.filterCard({ name: card[2], nature: card[3] }, player, event));
		},
		chooseButton: {
			dialog(event, player) {
				var list = get
					.inpileVCardList(info => {
						const name = info[2];
						return get.type(name) == "basic";
					})
					.filter(card => event.filterCard({ name: card[2], nature: card[3] }, player, event));
				return ui.create.dialog("博通", [list, "vcard"], "hidden");
			},
			check(button) {
				var player = _status.event.player;
				var evt = _status.event.getParent();
				var name = button.link[2],
					card = { name: name, nature: button.link[3] };
				if (name == "shan") {
					return 2;
				}
				if (evt.type == "dying") {
					if (get.attitude(player, evt.dying) < 2) {
						return 0;
					}
					if (name == "jiu") {
						return 2.1;
					}
					return 1.9;
				}
				if (evt.type == "phase") {
					if (button.link[2] == "jiu") {
						if (player.getUseValue({ name: "jiu" }) <= 0) {
							return 0;
						}
						var cards = player.getCards("hs", cardx => get.value(cardx) < 8);
						cards.sort((a, b) => get.value(a) - get.value(b));
						if (cards.some(cardx => get.name(cardx) == "sha" && !cards.slice(0, 2).includes(cardx))) {
							return player.getUseValue({ name: "jiu" });
						}
						return 0;
					}
					return player.getUseValue(card) / 4;
				}
				return 1;
			},
			backup(links, player) {
				return {
					selectCard: 4,
					position: "hes",
					complexCard: true,
					check(card) {
						if (ui.selected.cards.length > 4) {
							return 0;
						}
						return 8 - get.value(card);
					},
					filterCard(card, player, target) {
						if (ui.selected.cards.some(c => get.suit(c) == get.suit(card))) {
							return false;
						}
						return true;
					},
					popname: true,
					viewAs: {
						name: links[0][2],
						nature: links[0][3],
					},
				};
			},
			prompt(links, player) {
				var name = links[0][2];
				var nature = links[0][3];
				return "将四张花色各不同的牌当作" + (get.translation(nature) || "") + get.translation(name) + "使用";
			},
		},
		ai: {
			order(item, player) {
				if (player && _status.event.type == "phase") {
					var add = false,
						max = 0;
					var names = lib.inpile.filter(name => get.type(name) == "basic");
					if (names.includes("sha")) {
						add = true;
					}
					names = names.map(namex => {
						return { name: namex };
					});
					if (add) {
						lib.inpile_nature.forEach(nature => names.push({ name: "sha", nature: nature }));
					}
					names.forEach(card => {
						if (player.getUseValue(card) > 0) {
							var temp = get.order(card);
							if (card.name == "jiu") {
								var cards = player.getCards("hes", cardx => get.value(cardx) < 8);
								cards.sort((a, b) => get.value(a) - get.value(b));
								if (!cards.some(cardx => get.name(cardx) == "sha" && !cards.slice(0, 2).includes(cardx))) {
									temp = 0;
								}
							}
							if (temp > max) {
								max = temp;
							}
						}
					});
					if (max > 0) {
						max -= 0.001;
					}
					return max;
				}
				return 0.5;
			},
			respondShan: true,
			respondSha: true,
			fireAttack: true,
			skillTagFilter(player, tag, arg) {
				if (arg == "respond") {
					return false;
				}
				const name = tag == "respondShan" ? "shan" : "sha";
				return true;
			},
			result: {
				player(player) {
					if (_status.event.dying) {
						return get.attitude(player, _status.event.dying);
					}
					return 1;
				},
			},
		},
		subSkill: {
			count: { charlotte: true, onremove: true },
			backup: {},
			after: {
				trigger: { player: "useCardAfter" },
				filter(event, player) {
					return event.skill == "qj_botong_backup";
				},
				async content(event, trigger, player) {
					let cards = trigger.cards;
					event.given_map = {};
					if (!cards.length) {
						return;
					}
					do {
						const {
							result: { bool, links },
						} =
							cards.length == 1
								? { result: { links: cards.slice(0), bool: true } }
								: await player.chooseCardButton("博通：请选择要分配的牌", true, cards, [1, cards.length]).set("ai", () => {
										if (ui.selected.buttons.length == 0) {
											return 1;
										}
										return 0;
								  });
						if (!bool) {
							return;
						}
						cards.removeArray(links);
						event.togive = links.slice(0);
						const {
							result: { targets },
						} = await player
							.chooseTarget("选择一名角色获得" + get.translation(links), true, function (card, player, target) {
								return target != player;
							})
							.set("ai", target => {
								const att = get.attitude(_status.event.player, target);
								if (_status.event.enemy) {
									return -att;
								} else if (att > 0) {
									return att / (1 + target.countCards("h"));
								} else {
									return att / 100;
								}
							})
							.set("enemy", get.value(event.togive[0], player, "raw") < 0);
						if (targets.length) {
							const id = targets[0].playerid,
								map = event.given_map;
							if (!map[id]) {
								map[id] = [];
							}
							map[id].addArray(event.togive);
						}
					} while (cards.length > 0);
					if (_status.connectMode) {
						game.broadcastAll(function () {
							delete _status.noclearcountdown;
							game.stopCountChoose();
						});
					}
					const list = [];
					for (const i in event.given_map) {
						const source = (_status.connectMode ? lib.playerOL : game.playerMap)[i];
						player.line(source, "green");
						if (player !== source && (get.mode() !== "identity" || player.identity !== "nei")) {
							player.addExpose(0.2);
						}
						list.push([source, event.given_map[i]]);
					}
					game.loseAsync({
						gain_list: list,
						giver: player,
						animate: "draw",
					}).setContent("gaincardMultiple");
				},
			},
		},
	},
	qj_fenyue: {
		enable: "phaseUse",
		usable(skill, player) {
			let identities = [];
			for (let i of game.players) {
				if (i.identity != player.identity && !identities.includes(i.identity)) {
					identities.push(i.identity);
				}
			}
			return identities.length;
		},
		filter(event, player) {
			if (player.countCards("h") == 0) {
				return false;
			}
			return (
				game.hasPlayer(function (current) {
					return player.canCompare(current);
				}) && !player.hasSkill("qj_fenyue_used")
			);
		},
		filterTarget(card, player, target) {
			return player.canCompare(target);
		},
		async content(event, trigger, player) {
			const target = event.target;
			const result = await player.chooseToCompare(target).forResult();
			if (!result.bool) {
				player.addTempSkill("qj_fenyue_used", "phaseEnd");
			} else {
				player.line(target);
				player.addTempSkill("qj_fenyue_forbid", { player: ["qj_fenyue_forbidAfter", "phaseAfter"] });
				player.markAuto("qj_fenyue_forbid", [target]);
				if (result.num1 < 9 && player.canUse({ name: "sha", isCard: true, nature: "fire" }, target, false)) {
					await player.useCard({ name: "sha", isCard: true, nature: "fire" }, target, false);
				}
			}
		},
		subSkill: {
			forbid: {
				charlotte: true,
				onremove: true,
				intro: { content: "$不可响应你本回合使用的下一张牌" },
				trigger: { player: "useCard" },
				forced: true,
				popup: false,
				sourceSkill: "qj_fenyue",
				async content(event, trigger, player) {
					awaitgame.delayx();
					var targets = player.getStorage("qj_fenyue_forbid");
					player.line(targets, "fire");
					trigger.directHit.addArray(targets);
				},
			},
			used: {
				charlotte: true,
				onremove: true,
			},
		},
	},
	qj_jingnu: {
		enable: "phaseUseEnd",
		preHidden: true,
		filter(event, player) {
			let evts = player.getHistory("useCard");
			if (evts.length < 2) {
				return false;
			}
			if (evts.slice(-2).every(evt => evt.card.name != "sha")) {
				return true;
			}
			if (evts.every(evt => evt.card.name == "sha")) {
				return true;
			}
			return false;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget("视为对一名角色使用一张【杀】", function (card, player, target) {
					return player.canUse({ name: "sha", isCard: true }, target);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			if (player.canUse({ name: "sha", isCard: true }, event.target)) {
				await player.useCard({ name: "sha", isCard: true }, event.target);
			}
		},
	},
	qj_weitun: {
		enable: "phaseDiscardBegin",
		limited: true,
		preHidden: true,
		filter(event, player) {
			return !game.hasPlayer(current => current.countCards("h") > player.countCards("h") && current.isIn());
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget("视为对任意名角色使用【桃园结义】和【五谷丰登】")
				.set("ai", target => {
					return get.attitude(player, target);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			await player.useCard({ name: "taoyuan", isCard: true }, event.targets);
			await player.useCard({ name: "wugu", isCard: true }, event.targets);
		},
	},
	qj_kannan: {
		enable: "phaseUse",
		filter(event, player) {
			if (player.countCards("h") == 0) {
				return false;
			}
			return (
				game.hasPlayer(function (current) {
					for (let i of player.getStat()._qj_kannan) {
						if (current.isFriendOf(i)) {
							return false;
						}
					}
					return player.canCompare(current);
				}) && !player.hasSkill("qj_kannan_used")
			);
		},
		filterTarget(card, player, target) {
			for (let i of player.getStat()._qj_kannan) {
				if (current.isFriendOf(i)) {
					return false;
				}
			}
			return player.canCompare(target);
		},
		async content(event, trigger, player) {
			const target = event.target;
			const result = await player.chooseToCompare(target).forResult();
			if (result.num1 < result.num2) {
				let result1 = await target
					.chooseControl()
					.set("choiceList", ["获得没赢的拼点牌并令" + get.translation(player) + "本回合使用下张【杀】伤害+1", "cancel2"])
					.set("choice", () => {
						return get.attitude(target, player) > 0 ? 0 : 1;
					})
					.forResult();
				if (result1.control != "cancel2") {
					await target.gain(result.num1, "gain2");
					player.addTempSkill("qj_kannan_damage");
					player.addMark("qj_kannan_damage", 1, false);
					game.log(player, "本回合下一张【杀】造成的伤害", "#g+1");
				}
			} else if (result.num1 > result.num2) {
				let result1 = await player
					.chooseControl()
					.set("choiceList", ["获得没赢的拼点牌并令" + get.translation(player) + "本回合使用下张【杀】伤害+1", "cancel2"])
					.set("choice", 0)
					.forResult();
				if (result1.control != "cancel2") {
					await target.gain(result.num2, "gain2");
					player.addTempSkill("qj_kannan_damage");
					player.addMark("qj_kannan_damage", 1, false);
					game.log(player, "本回合下一张【杀】造成的伤害", "#g+1");
				}
				player.addTempSkill("qj_kannan_used");
			}
			var stat = player.getStat();
			if (!stat._qj_kannan) {
				stat._qj_kannan = [];
			}
			stat._qj_kannan.push(event.target);
		},
		subSkill: {
			damage: {
				charlotte: true,
				onremove: true,
				trigger: { source: "damageBegin1" },
				filter(event, player) {
					return event.card?.name === "sha";
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					trigger.num += player.countMark(event.name);
					player.removeSkill(event.name);
				},
				intro: { content: "本回合下一张【杀】造成的伤害+#" },
			},
			used: {
				charlotte: true,
				onremove: true,
			},
		},
	},
	qj_niju: {
		trigger: {
			player: ["chooseToCompareAfter", "compareMultipleAfter"],
			target: ["chooseToCompareAfter", "compareMultipleAfter"],
		},
		forced: true,
		locked: true,
		preHidden: true,
		filter(event, player) {
			if (event.preserve) {
				return false;
			}
			if (player == event.player) {
				return trigger.num1 <= trigger.num2;
			} else {
				if (event.num1 < event.num2) {
					return !get.owner(event.card1);
				} else {
					return !get.owner(event.card2);
				}
			}
		},
		async content(event, trigger, player) {
			if ((player == trigger.player && trigger.num1 <= trigger.num2) || (player != trigger.player && trigger.num2 <= trigger.num1)) {
				if (!player.hasSkill("qj_niju_add")) {
					player.addTempSkill("qj_niju_add", "phaseEnd");
				}
				player.markAuto("qj_niju_add", 1);
			}
			if (trigger.num1 == trigger.num2) {
				player.draw();
			}
		},
		subSkill: {
			add: {
				trigger: { player: "compare", target: "compare" },
				filter(event, player) {
					if (player != event.target && event.iwhile) {
						return false;
					}
					return true;
				},
				forced: true,
				locked: true,
				onremove: true,
				charlotte: true,
				async content(event, trigger, player) {
					var num = player.getStorage("qj_niju_add")?.length;
					if (num > 0) {
						if (player == trigger.player) {
							trigger.num1 += num * 3;
							if (trigger.num1 > 13) {
								trigger.num1 = 13;
							}
						} else {
							trigger.num2 += num * 3;
							if (trigger.num2 > 13) {
								trigger.num2 = 13;
							}
						}
						game.log(player, "的拼点牌点数+", num);
					}
				},
			},
		},
	},
	qj_jibing: {
		trigger: { player: "phaseDrawBegin2" },
		preHidden: true,
		filter(event, player) {
			return !event.numFixed;
		},
		async content(event, trigger, player) {
			let count = game.countPlayer(function (current) {
				return current.isFriendOf(player);
			});
			trigger.num += count;
			player.markAuto("qj_jibing_effect", count);
			player.addTempSkill("qj_jibing_effect");
		},
		subSkill: {
			effect: {
				charlotte: true,
				onremove: true,
				forced: true,
				trigger: { global: "phaseEnd" },
				filter(event, player) {
					return player.getStorage("qj_jibing_effect") && player.getStorage("qj_jibing_effect").length && player.getHistory("sourceDamage").length < player.getStorage("qj_jibing_effect")[0];
				},
				async content(event, trigger, player) {
					player.loseHp();
				},
			},
		},
	},
	qj_niujin: {
		trigger: {
			global: "phaseEnd",
		},
		getIndex(event) {
			return 3;
		},
		filter(event, player, name) {
			return event.player.isFriendOf(player);
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseToUse(get.prompt2(event.skill))
				.set("filterCard", function (card, player) {
					if (player.getStorage("qj_niujin") && player.getStorage("qj_niujin").includes(get.type(card))) {
						return false;
					}
					return lib.filter.cardEnabled(card, player, "forceEnable");
				})
				.set("chooseonly", true)
				.set("logSkill", event.name.slice(0, -5))
				.forResult();
		},
		popup: false,
		async content(event, trigger, player) {
			const { ResultEvent, logSkill } = event.cost_data;
			event.next.push(ResultEvent);
			if (logSkill) {
				if (typeof logSkill == "string") {
					ResultEvent.player.logSkill(logSkill);
				} else if (Array.isArray(logSkill)) {
					ResultEvent.player.logSkill.call(ResultEvent.player, ...logSkill);
				}
			}
			await ResultEvent;
			const card = ResultEvent.card;
			player.markAuto("qj_niujin", get.type(card));
			let killed = false;
			for (let e1 of player.getHistory("sourceDamage", evt => evt.card == card)) {
				for (let e2 of e1.childEvents) {
					if (e2.name == "dying") {
						for (let e3 of e2.childEvents) {
							if (e3.name == "die") {
								killed = true;
								break;
							}
						}
					}
				}
			}
			if (killed) {
				player.draw(3);
			}
		},
	},
	qj_zhoucang: {
		trigger: { player: "useCardAfter" },
		audio: "zhongyong",
		filter(event, player) {
			return event.card.name == "sha";
		},
		async cost(event, trigger, player) {
			event.sha = trigger.cards.slice(0).filterInD();
			event.shan = [];
			game.countPlayer2(function (current) {
				current.getHistory("useCard", function (evt) {
					if (evt.card.name == "shan" && evt.getParent(3) == trigger) {
						event.shan.addArray(evt.cards);
					}
				});
			});
			event.shan.filterInD("d");
			if (!event.sha.length && !event.shan.length) {
				return;
			}
			await player
				.chooseTarget(get.prompt2("xinzhongyong"), function (card, player, target) {
					return !_status.event.source.includes(target) && target != player;
				})
				.set("ai", function (target) {
					return get.attitude(_status.event.player, target);
				})
				.set("source", trigger.targets);
		},
		async content(event, trigger, player) {
			var target = result.targets[0];
			event.target = target;
			player.logSkill("xinzhongyong", target);
			if (event.sha.length && event.shan.length) {
				await player
					.chooseControl()
					.set("choiceList", ["将" + get.translation(event.sha) + "交给" + get.translation(target), "将" + get.translation(event.shan) + "交给" + get.translation(target)])
					.set("ai", function () {
						return _status.event.choice;
					})
					.set(
						"choice",
						(function () {
							if (get.color(event.sha) != "black") {
								return 0;
							}
							return 1;
						})()
					);
			} else {
				event._result = { index: event.sha.length ? 0 : 1 };
			}
			var cards = result.index == 0 ? event.sha : event.shan;
			event.useSha = false;
			await target.gain(cards, "gain2");
			for (var i = 0; i < cards.length; i++) {
				if (get.color(cards[i]) == "red") {
					event.useSha = true;
					break;
				}
			}
			if (event.useSha) {
				await event.target
					.chooseToUse("是否使用一张杀？", { name: "sha" })
					.set("filterTarget", function (card, player, target) {
						return target != _status.event.sourcex && _status.event.sourcex.inRange(target) && lib.filter.targetEnabled.apply(this, arguments);
					})
					.set("sourcex", player)
					.set("addCount", false);
			}
		},
	},
	qj_quexiaojiang: {
		trigger: { player: "useCardAfter" },
		usable: 1,
		filter(event, player) {
			var evt = player.getLastUsed(1);
			if (!evt || !evt.card || !player.getHistory("useCard", e => e.card == evt.card).length || !player.getHistory("useCard", e => e.card == event.card).length) {
				return false;
			}
			var targets1 = player.getHistory("useCard", e => e.card == evt.card).targets;
			var targets2 = player.getHistory("useCard", e => e.card == event.card).targets;
			return targets1.length === targets2.length ? targets1.some(item => targets2.includes(item)) && !targets1.every(item => targets2.includes(item)) : targets1.some(item => targets2.includes(item));
		},
		async cost(event, trigger, player) {
			var evt = player.getLastUsed(1);
			if (!evt || !evt.card || !player.getHistory("useCard", e => e.card == evt.card).length || !player.getHistory("useCard", e => e.card == event.card).length) {
				return false;
			}
			var targets1 = player.getHistory("useCard", e => e.card == evt.card).targets;
			var targets2 = player.getHistory("useCard", e => e.card == event.card).targets;
			let targets = targets1.filter(item => targets2.includes(item));
			if (targets.length) {
				event.result = await player
					.chooseTarget("是否对其中一名角色造成1点伤害？", function (card, player, target) {
						return targets.includes(target);
					})
					.set("ai", function (target) {
						return -get.attitude(_status.event?.player, target);
					})
					.set("target", trigger.target)
					.forResult();
			}
		},
		async content(event, trigger, player) {
			await event.targets[0].damage();
		},
	},
	qj_wenhu: {
		enable: "phaseUse",
		usable: 1,
		hiddenCard(player, name) {
			if (name != "juedou") {
				return false;
			}
			return viewAsFilter(player);
		},
		get viewAs() {
			return {
				name: "juedou",
				isCard: true,
			};
		},
		get mod() {
			return {
				selectTarget(card, player, range) {
					let region = 0;
					if (player.countCards("h") > 0) {
						region++;
					}
					if (player.countCards("e") > 0) {
						region++;
					}
					if (player.countCards("j") > 0) {
						region++;
					}
					if (range.length && range[1] != -1) {
						range[1] = region;
					}
				},
			};
		},
		viewAsFilter(player) {
			return player.countCards("hej") > 0;
		},
		filterCard: () => false,
		prompt: "视为使用【决斗】",
		selectCard: [0, 1],
		check: () => 1,
		log: false,
		async precontent(event, trigger, player) {
			let choices = [];
			if (player.countCards("h") > 0) {
				choices.push("手牌区");
			}
			if (player.countCards("e") > 0) {
				choices.push("装备区");
			}
			if (player.countCards("j") > 0) {
				choices.push("判定区");
			}
			if (choices.length == 0) return;
			let choice = [];
			for (let i = 0; i < event.result.targets.length; i++) {
				if (choices.length == event.result.targets.length) {
					choice.push(...choices);
					break;
				}
				const result = await player
					.chooseControl(choices)
					.set("ai", () => {
						if (choices.includes("判定区")) {
							return "判定区";
						}
						if (choices.includes("装备区") && get.value(player.getCards("h")) > get.value(player.getCards("e"))) {
							return "装备区";
						}
						return "手牌区";
					})
					.forResult();
				choice.push(result.control);
				choices.remove(result.control);
			}
			for (let c of choice) {
				if (c == "手牌区") {
					await player.discard(player.getCards("h"));
				}
				if (c == "装备区") {
					await player.discard(player.getCards("e"));
				}
				if (c == "判定区") {
					await player.discard(player.getCards("j"));
				}
			}
		},
		ai: {
			order: 1,
			result: {
				player(player) {
					return player.getUseValue({ name: "juedou" });
				},
			},
		},
	},
	qj_mushun: {
		trigger: {
			global: ["loseAfter", "loseAsyncAfter"],
		},
		filter(event, player) {
			if (player.hasSkill("qj_mushun_used") || event.type != "discard" || (event.player != player && event.discarder != player)) {
				return false;
			}
			return event.cards2 && event.cards2.length;
		},
		async content(event, trigger, player) {
			const cards = [];
			const evt1 = trigger.getl(player);
			if (evt1 && evt1.cards2) {
				cards.addArray(evt1.cards2.filterInD("d"));
			}
			const evt2 = trigger.getl(trigger.player);
			if (evt2 && evt2.cards2) {
				cards.addArray(evt2.cards2.filterInD("d"));
			}
			const result = await player
				.chooseCardButton("选择是否获得其中一张牌", true, cards, 1)
				.set("check", function (button, player, trigger) {
					if (_status.currentPhase != player) {
						return 1;
					}
					if (trigger.getParent("phaseDiscard").name) {
						return 1;
					}
					return player.hp > 1;
				})
				.set("ai", function (button) {
					return get.value(button.link, player);
				})
				.forResult();
			if (result.bool && result?.links) {
				const links = result.links;
				if (links.length) {
					await player.gain(links[0], "gain2");
					player.addTempSkill("qj_mushun_used", "phaseJieshuAfter");
					player.markAuto("qj_mushun_used", trigger);
				}
			}
		},
		subSkill: {
			used: {
				charlotte: true,
				forced: true,
				trigger: {
					global: ["loseAfter", "loseAsyncAfter"],
				},
				filter(event, player) {
					if (player.hasSkill("qj_mushun_used2") || event.type != "discard" || (event.player != player && event.discarder != player) || (player.storage.qj_mushun_used && player.storage.qj_mushun_used.length && player.storage.qj_mushun_used[0] == event)) {
						return false;
					}
					return event.cards2 && event.cards2.length;
				},
				async content(event, trigger, player) {
					player.loseHp();
					player.addTempSkill("qj_mushun_used2", "phaseJieshuAfter");
				},
			},
			used2: {
				charlotte: true,
			},
		},
	},
	qj_huweijun: {
		trigger: {
			global: "phaseEnd",
		},
		filter(event, player) {
			let num1 = player.getHistory("sourceDamage").reduce((num, evt) => {
				return num + (evt?.num || 0);
			}, 0);
			let num2 = player.getHistory("damage").reduce((num, evt) => {
				return num + (evt?.num || 0);
			}, 0);
			return player.canMoveCard() && num1 + num2 > 1;
		},
		check(event, player) {
			return player.canMoveCard(true);
		},
		async content(event, trigger, player) {
			await player.moveCard(true);
		},
	},
	qj_baimayicong: {
		trigger: { player: ["useCard", "respond"] },
		filter(event, player) {
			if (event.card.name != "shan") {
				return false;
			}
			var target = lib.skill.qj_baimayicong.logTarget(event, player);
			return target && target.countGainableCards(player, "he") > 0;
		},
		logTarget(event, player) {
			if (event.name == "respond") {
				return event.source;
			}
			return event.respondTo[0];
		},
		prompt2(event, player) {
			var target = lib.skill.qj_baimayicong.logTarget(event, player);
			return "获得" + get.translation(target) + "的一张牌";
		},
		content() {
			var target = lib.skill.qj_baimayicong.logTarget(trigger, player);
			player.gainPlayerCard(target, "he", true);
		},
		ai: {
			mingzhi: false,
			effect: {
				target(card, player, target, current) {
					if (get.tag(card, "respondShan")) {
						if (get.attitude(target, player) <= 0) {
							if (current > 0) {
								return;
							}
							if (target.countCards("he") == 0) {
								return 1.6;
							}
							if (target.countCards("he") == 1) {
								return 1.2;
							}
							if (target.countCards("he") == 2) {
								return [0.8, 0.2, 0, -0.2];
							}
							return [0.4, 0.7, 0, -0.7];
						}
					}
				},
			},
		},
	},
	qj_xiangbing: {
		forced: true,
		locked: true,
		group: "qj_xiangbing_damage",
		trigger: {
			player: "useCardAfter",
		},
		filter(event, player) {
			return (
				event.targets.some(target => {
					return target.hasHistory("damage", evt => evt.card == event.card) && target.isIn();
				}) && event.card.name == "sha"
			);
		},
		async content(event, trigger, player) {
			let targets = trigger.targets.filter(target => {
				return target.hasHistory("damage", evt => evt.card == trigger.card);
			});
			await player.useCard({ name: "nanman", isCard: true }, targets, false);
		},
		subSkill: {
			damage: {
				forced: true,
				charlotte: true,
				trigger: {
					player: "damageEnd",
				},
				filter(event, player) {
					return event.hasNature("fire");
				},
				async content(event, trigger, player) {
					const targets = [target.getPrevious(), target.getNext()].unique().sortBySeat();
					if (targets.length) {
						await player.useCard({ name: "sha", isCard: true }, targets, false);
					}
				},
			},
		},
	},
	qj_jinfanjun: {
		trigger: {
			global: ["loseAfter", "loseAsyncAfter"],
		},
		filter(event, player) {
			if (event.type != "discard" || event.discarder != player || !event.cards2 || !event.cards2.length) {
				return false;
			}
			if (player.storage.qj_jinfanjun && player.storage.qj_jinfanjun.length) {
				for (let i in event.cards2) {
					if (!player.storage.qj_jinfanjun.includes(get.color(event.cards2[i]))) {
						return true;
					}
				}
				return false;
			}
			return true;
		},
		async content(event, trigger, player) {
			const cards = [];
			const evt2 = trigger.getl(trigger.player);
			if (evt2 && evt2.cards2) {
				cards.addArray(evt2.cards2.filterInD("d"));
			}
			let colors = [];
			for (let i in cards) {
				if (!colors.includes(get.color(cards[i]))) {
					colors.push(get.color(cards[i]));
				}
			}
			let colors1 = [];
			if (player.storage.qj_jinfanjun && player.storage.qj_jinfanjun.length) {
				for (let i in colors) {
					if (!player.storage.qj_jinfanjun.includes(colors[i])) {
						colors1.push(colors[i]);
					}
				}
			} else {
				colors1 = colors;
			}
			if (colors1.length) {
				const result = await player
					.chooseToDiscard("弃一张牌以摸两张牌", "he", function (card) {
						return colors1.includes(get.color(card));
					})
					.forResult();
				if (result.bool) {
					await player.draw(2);
				}
			}
		},
	},
	qj_bingzhoulangqi: {
		enable: "phaseUse",
		usable: 1,
		filterTarget(card, player, target) {
			return target != player && target.canUse("juedou", player);
		},
		async content(event, trigger, player) {
			await event.target.useCard({ name: "juedou", isCard: true }, player, "noai");
			player.addTempSkill("qj_bingzhoulangqi_buff");
			player.markAuto("qj_bingzhoulangqi_buff", event.target);
		},
		ai: {
			order: 2,
			result: {
				player(player, target) {
					return get.effect(player, { name: "juedou", isCard: true }, target, player);
				},
			},
		},
		subSkill: {
			buff: {
				charlotte: true,
				onremove: true,
				mod: {
					globalFrom(from, to) {
						if (from.getStorage("qj_bingzhoulangqi_buff").includes(to)) {
							return -Infinity;
						}
					},
				},
				intro: {
					content: "计算与$的距离视为1",
				},
				sourceSkill: "qj_bingzhoulangqi",
			},
		},
	},
	qj_huangjinleishi: {
		trigger: {
			global: "damageBegin1",
		},
		filter(event, player) {
			if (
				!player.hasMark("qj_huangjinleishi_triggered") &&
				event.source.getHistory("lose", function (evt) {
					return (evt.relatedEvent || evt.getParent()) == event.getParent().getParent() && evt.hs && evt.hs.length == event.cards.length;
				}).length == 0
			) {
				player.markAuto("qj_huangjinleishi_triggered", "triggered");
				player.addTempSkill("qj_huangjinleishi_triggered");
				return player.countCards("h") > 0;
			}
			return false;
		},
		logTarget: "player",
		async cost(event, trigger, player) {
			let source = trigger.source;
			event.result = await player
				.chooseToDiscard("h")
				.set("check", function (card, player, source) {
					return get.attitude(player, source);
				})
				.set("ai", function (card) {
					return 8 - get.value(card);
				})
				.set("prompt", "弃置一张手牌并判定，若为：黑色，此伤害+1；红色，伤害来源获得此判定牌。。")
				.forResult();
		},
		async content(event, trigger, player) {
			const result = await player.judge(card => (get.color(card) == "red" ? 1 : 0)).forResult();

			switch (result.color) {
				case "black":
					trigger.num++;
					break;
				case "red":
					await trigger.source.gain(result.card, "gain2");
					break;
			}
		},
		subSkill: {
			triggered: {
				onremove: true,
			},
		},
	},
	qj_xiliangjingqi: {
		trigger: {
			player: "phaseJieshuBegin",
		},
		group: "qj_xiliangjingqi_sha",
		filter(event, player) {
			return player.hasSha();
		},
		async content(event, trigger, player) {
			if (trigger.delay === false) {
				game.delayx();
			}
			await player.chooseToUse("是否使用一张【杀】？", function (card) {
				if (get.name(card) != "sha") {
					return false;
				}
				return lib.filter.cardEnabled.apply(this, arguments);
			});
		},
		subSkill: {
			sha: {
				trigger: {
					player: "useCardToPlayered",
				},
				filter(event, player) {
					return event.card.name == "sha" && !event.target.inRange(player);
				},
				async content(event, trigger, player) {
					await trigger.target.chooseToDiscard("he", true);
				},
			},
		},
	},
	qj_fuxinsishi: {
		trigger: {
			player: "phaseEnd",
		},
		filter(event, player, name) {
			if (!event.player.isFriendOf(player)) {
				return false;
			}
			const skills = event.player.getOriginalSkills();
			const list1 = skills.filter(skill => lib.skill[skill].limited && !event.player.awakenedSkills.includes(skill));
			const list2 = skills.filter(
				skill =>
					lib.skill[skill].limited &&
					player.getHistory("useSkill", evt => {
						return evt.skill == skill;
					}).length
			);
			return list1.length > 0 || list2.length > 0;
		},
		async content(event, trigger, player) {
			const skills = event.player.getOriginalSkills();
			const list1 = skills.filter(skill => lib.skill[skill].limited && !event.player.awakenedSkills.includes(skill));
			const list2 = skills.filter(
				skill =>
					lib.skill[skill].limited &&
					event.player.getHistory("useSkill", evt => {
						return evt.skill == skill;
					}).length
			);
			if (list1.length) {
				await player.draw();
			}
			if (list2.length) {
				let result = await player
					.chooseTarget("视为使用一张杀", true, function (card, player, target) {
						if (!player.canUse("sha", target, false)) {
							return false;
						}
						const source = _status.event.player;
						return target != source && source.inRange(target);
					})
					.set("ai", function (target) {
						var player = _status.event.player;
						return get.effect(target, { name: "sha" }, player, player);
					})
					.forResult();
				player.useCard({ name: "sha", isCard: true }, result.targets[0], false);
			}
		},
	},
	qj_xiyuanjun: {
		trigger: {
			global: "phaseUseBegin",
		},
		filter(event, player) {
			return event.player.isFriendOf(player) && game.hasPlayer(target => lib.skill.qj_xiyuanjun.filterTarget(null, player, target));
		},
		filterTarget(card, player, target) {
			return target.countCards("he");
		},
		async cost(event, trigger, player) {
			event.result = await player
				.choosePlayerCard(target, "h", true)
				.set("filterButton", function (button) {
					var card = button.link,
						owner = get.owner(card);
					return !owner;
				})
				.set("ai", function (card) {
					if (get.attitude(_status.event.player, _status.event.getParent().target) >= 0) {
						return -1;
					}
					return get.buttonValue(card);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const cards = event.cards,
				target = trigger.player;
			target.showCards(cards, "展示手牌");
			player.addShownCards(cards, "visible_qj_xiyuanjun");
			target.addTempSkill("qj_xiyuanjun_gain");
		},
		subSkill: {
			gain: {
				group: "qj_xiyuanjun_3",
				onremove(player) {
					player.hideShownCards(player.getCards("h"), "visible_qj_xiyuanjun");
				},
				mod: {
					cardEnabled(card) {
						if (card.hasGaintag("visible_qj_xiyuanjun")) {
							return false;
						}
					},
				},
				trigger: { player: "damageEnd" },
				async content(event, trigger, player) {
					const hs = player.getCards("h", function (card) {
						return card.hasGaintag("visible_qj_xiyuanjun");
					});
					for (let i in hs) {
						player.hideShownCards(player.getCards("h"), "visible_qj_xiyuanjun");
					}
					if (hs.length && trigger.source != player) {
						await trigger.source.gain(hs, "gain2");
					}
				},
				charlotte: true,
				forced: true,
			},
		},
	},

	// 统领技能统一管理
	tl_xuchu: {
		...createTonglingSkill("tl_xuchu", "yc_huweijun", "juedou", "【决斗】"),
	},
	tl_caoren: {
		...createTonglingSkill("tl_caoren", "yc_niujin", "wuxie", "国【无懈可击】", true).set("viewAs", { tags: ["guo"] }),
	},
	tl_dianwei: {
		...createTonglingSkill("tl_dianwei", "yc_huweijun", "juedou", "【决斗】"),
	},
	tl_guanyu: {
		...createTonglingSkill("tl_guanyu", "yc_zhoucang", "jiu", "【酒】", true),
	},
	tl_zhaoyun: {
		...createTonglingSkill("tl_zhaoyu", "yc_baimayicong", "wuxie", "【无懈可击】"),
	},
	tl_machao: {
		...createTonglingSkill("tl_machao", "yc_xiliangjingqi", "sha", "【杀】"),
	},
	tl_zhurongfuren: {
		...createTonglingSkill("tl_zhurongfuren", "yc_xiangbing", "sha", "【杀】")
			.set("viewAs", { storage: { tl_zhurongfuren: true } })
			.set("mod", {
				targetInRange(card, player, target) {
					if (card.storage && card.storage.tl_zhurongfuren) {
						return true;
					}
				},
			}),
	},
	tl_ganning: {
		...createTonglingSkill("tl_ganning", "yc_jinfanjun", "wuxie", "【无懈可击】"),
	},
	tl_taishici: {
		...createTonglingSkill("tl_taishici", "yc_quexiaojiang", "sha", "【杀】", true),
	},
	tl_lvbu: {
		...createTonglingSkill("tl_lvbu", "yc_bingzhoulangqi", "sha", "【杀】"),
	},
	tl_zhangjiao: {
		...createTonglingSkill("tl_zhangjiao", "yc_huangjinleishi", "lulitongxin", "【勠力同心】"),
	},
	tl_mateng: {
		...createTonglingSkill("tl_mateng", "yc_xiliangjingqi", "sha", "【杀】"),
	},
	tl_hansui: {
		...createTonglingSkill("tl_hansui", "yc_xiliangjingqi", "zhujinqiyuan", "【逐近弃远】"),
	},
	tl_simashi: {
		...createTonglingSkill("tl_simazhao", "yc_fuxinsishi", "chuqibuyi", "♥【出其不意】").set("viewAs", { suit: "heart", tags: ["yingbian_zhuzhan", "yingbian_add"] }),
	},
	tl_jin_simayi: {
		...createTonglingSkill("tl_jin_simayi", "yc_fuxinsishi", "diaohulishan", "【调虎离山】"),
	},
	tl_wenyang: {
		...createTonglingSkill("tl_wenyang", "yc_wenhu", "sha", "冰【杀】", true).set("viewAs", { nature: "ice" }),
	},
	tl_fuwan: {
		...createTonglingSkill("tl_fuwan", "yc_mushun", "shan", "【闪】", true),
	},
	tl_jianshuo: {
		...createTonglingSkill("tl_jianshuo", "yc_xiyuanjun", "shan", "【闪】"),
	},
};

export default skill;
export { createTonglingSkill };
