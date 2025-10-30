import { lib, game, ui, get, ai, _status } from "../../../noname.js";

/** @type { importCharacterConfig['skill'] } */
const skill = {
	qj_jianxiong: {
		audio: "jianxiong",
		trigger: {
			player: "damageEnd",
		},
		preHidden: true,
		async cost(event, trigger, player) {
			let list = ["摸一张牌"];
			if (
				get.itemtype(trigger.cards) == "cards" &&
				trigger.cards.filterInD().length
			) {
				list.push("获得对你造成伤害的牌");
			}
			list.push("cancel2");
			const {
				result: { control },
			} = await player
				.chooseControl(list)
				.set("prompt", get.prompt2("rejianxiong_old"))
				.set("ai", () => {
					const player = get.event("player"),
						trigger = get.event().getTrigger();
					const cards = trigger.cards
						? trigger.cards.filterInD()
						: [];
					// @ts-expect-error 类型就是这么写的
					if (get.event().controls.includes("获得对你造成伤害的牌")) {
						if (
							cards.reduce((sum, card) => {
								return sum + (card.name == "du" ? -1 : 1);
							}, 0) > 1 ||
							player.getUseValue(cards[0]) > 6
						) {
							return "获得对你造成伤害的牌";
						}
					}
					return "摸一张牌";
				});
			event.result = {
				bool: control != "cancel2",
				cost_data: { result: control },
			};
		},
		async content(event, trigger, player) {
			if (event.cost_data.result == "摸一张牌") {
				await player.draw();
			} else {
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
		audio: 2,
		audioname: ["new_simayi"],
		trigger: { global: "judge" },
		preHidden: true,
		direct: true,
		filter(event, player) {
			return player.countCards("hes") > 0;
		},
		async cost(event, trigger, player) {
			let prompt =
				get.translation(trigger.player) +
				"的" +
				(trigger.judgestr || "") +
				"判定为" +
				get.translation(trigger.player.judging[0]) +
				"，" +
				get.prompt("reguicai");
			const next = player.chooseCard(prompt, "hes", function (card) {
				var player = _status.event.player;
				var mod2 = game.checkMod(
					card,
					player,
					"unchanged",
					"cardEnabled2",
					player
				);
				if (mod2 != "unchanged") {
					return mod2;
				}
				var mod = game.checkMod(
					card,
					player,
					"unchanged",
					"cardRespondable",
					player
				);
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
			await player.respond(
				event.cards,
				"qj_guicai",
				"highlight",
				"noOrdering"
			);
			if (trigger.player.judging[0].clone) {
				trigger.player.judging[0].clone.classList.remove(
					"thrownhighlight"
				);
				game.broadcast(function (card) {
					if (card.clone) {
						card.clone.classList.remove("thrownhighlight");
					}
				}, trigger.player.judging[0]);
				game.addVideo(
					"deletenode",
					player,
					get.cardsInfo([trigger.player.judging[0].clone])
				);
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
		audio: 2,
		trigger: { player: "damageEnd" },
		logTarget: "source",
		preHidden: true,
		filter(event, player) {
			return (
				event.source &&
				event.source.countGainableCards(
					player,
					event.source != player ? "he" : "e"
				) > 0 &&
				event.num > 0
			);
		},
		async content(event, trigger, player) {
			player.gainPlayerCard(
				true,
				trigger.source,
				trigger.source != player ? "he" : "e"
			);
		},
		ai: {
			maixie_defend: true,
			effect: {
				target(card, player, target) {
					if (
						player.countCards("he") > 1 &&
						get.tag(card, "damage")
					) {
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
		audio: "ganglie", // TODO: 改成独立的配音
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
			const result = await player
				.judge((card) => (get.color(card) == "red" ? 1 : 0))
				.forResult();

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
	qj_qingjian: {
		audio: 2,
		trigger: {
			player: "gainAfter",
			global: "loseAsyncAfter",
		},
		preHidden: true,
		usable: 1,
		filter(event, player) {
			var evt = event.getParent("phaseDraw");
			if (evt.player == player) {
				return false;
			}
			return event.getg(player).length > 0;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCardTarget({
					position: "he",
					filterCard: true,
					selectCard: [1, Infinity],
					filterTarget: lib.filter.notMe,
					ai1(card) {
						const player = get.player();
						if (
							card.name != "du" &&
							get.attitude(player, _status.currentPhase) < 0 &&
							_status.currentPhase?.needsToDiscard()
						) {
							return -1;
						}
						for (var i = 0; i < ui.selected.cards.length; i++) {
							if (
								get.type(ui.selected.cards[i]) ==
									get.type(card) ||
								(ui.selected.cards[i].name == "du" &&
									card.name != "du")
							) {
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
						if (
							ui.selected.cards.length &&
							ui.selected.cards[0].name == "du"
						) {
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
		},
		ai: {
			expose: 0.3,
		},
	},
	qj_tuxi: {
		audio: "retuxi",
		audioname2: { gz_jun_caocao: "jianan_tuxi" },
		trigger: {
			player: "phaseDrawBegin2",
		},
		direct: true,
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
			const next = player.chooseTarget(
				get.prompt("new_retuxi"),
				"获得至多" +
					get.translation(num) +
					"名角色的各一张手牌，然后少摸等量的牌",
				[1, num],
				(card, player, target) =>
					target.countCards("h") > 0 && player != target
			);
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

				if (
					player.hasCard(
						(cardx) =>
							cardx != card &&
							(cardx.name == "sha" || cardx.name == "juedou") &&
							player.hasValueTarget(cardx, undefined, true),
						"hs"
					)
				) {
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
					return (
						event.card &&
						(event.card.name == "sha" ||
							event.card.name == "juedou") &&
						parent.type == "card"
					);
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
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return game.hasPlayer((current) => {
				if (current == player) {
					return false;
				}
				return current.hasCard((card) => {
					return lib.filter.canBeDiscarded(card, player, current);
				}, "e");
			});
		},
		derivation: "qj_shensu",
		direct: true,
		preHidden: true,
		async cost(event, trigger, player) {
			player
				.chooseTarget(
					get.prompt("jsrgqingzi"),
					"你可以弃置一名与你势力相同的其他角色装备区里的一张牌，然后令这些角色获得“神速”直到其回合结束",
					(card, player, target) => {
						return (
							target != player &&
							target.hasCard((card) => {
								return lib.filter.canBeDiscarded(
									card,
									player,
									target
								);
							}, "e") &&
							target.isFriendOf(player)
						);
					}
				)
				.set("ai", (target) => {
					var player = _status.event.player;
					return target.hasCard((card) => {
						return (
							(lib.filter.canBeDiscarded(card, player, target) &&
								get.value(card, target) > 3) ||
							(target.hp == 1 && get.value(card, target) > 0)
						);
					});
				});
		},
		async content(event, trigger, player) {
			var target = event.targets[0];
			if (
				target.hasCard((card) => {
					return lib.filter.canBeDiscarded(card, player, target);
				}, "e")
			) {
				player.discardPlayerCard(target, "e", true);
				const skill = event.name + "_effect";
				target.addAdditionalSkills(skill, "qj_shensu");
				target.addTempSkill(skill, { player: "phaseAfter" });
			}
		},
	},
	qj_yiji: {
		audio: 2,
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
						: await player
								.chooseCardButton(
									"遗计：请选择要分配的牌",
									true,
									cards,
									[1, cards.length]
								)
								.set("ai", () => {
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
					.chooseTarget(
						"选择一名角色获得" + get.translation(links),
						true
					)
					.set("ai", (target) => {
						const att = get.attitude(_status.event.player, target);
						if (_status.event.enemy) {
							return -att;
						} else if (att > 0) {
							return att / (1 + target.countCards("h"));
						} else {
							return att / 100;
						}
					})
					.set(
						"enemy",
						get.value(event.togive[0], player, "raw") < 0
					);
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
				const source = (
					_status.connectMode ? lib.playerOL : game.playerMap
				)[i];
				player.line(source, "green");
				if (
					player !== source &&
					(get.mode() !== "identity" || player.identity !== "nei")
				) {
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
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		frequent: true,
		preHidden: true,
		async content(event, trigger, player) {
			event.cards ??= [];
			while (true) {
				const judgeEvent = player.judge((card) => {
					if (get.color(card) == "black") {
						return 1.5;
					}
					return -1.5;
				});
				judgeEvent.judge2 = (result) => result.bool;
				judgeEvent.set("callback", async (event) => {
					if (event.judgeResult.color == "black") {
						event.getParent().orderingCards.remove(event.card);
					}
				});
				let result;
				result = await judgeEvent.forResult();
				if (result?.bool && result?.card) {
					event.cards.push(result.card);
					result = await player
						.chooseBool("是否再次发动【洛神】？")
						.set("frequentSkill", "luoshen")
						.forResult();
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
				const cards = player.getCards(
					"hs",
					(card) =>
						get.name(card) == "shan" || get.color(card) == "black"
				);
				cards.sort((a, b) => {
					return (
						(get.name(b) == "shan" ? 1 : 2) -
						(get.name(a) == "shan" ? 1 : 2)
					);
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
		audio: 2,
		audioname: ["sb_zhenji"],
		audioname2: {
			re_zhenji: "reqingguo",
		},
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
		audio: "shensu1", // TODO: 独立素材，留给后来人
		audioname: ["xiahouba", "re_xiahouyuan", "ol_xiahouyuan"],
		group: ["qj_shensu_1", "qj_shensu_2", "qj_shensu_3"],
		preHidden: ["qj_hensu_1", "qj_shensu_2", "qj_shensu_3"],
	},
	qj_shensu_1: {
		audio: 2,
		audioname: ["xiahouba", "re_xiahouyuan", "ol_xiahouyuan"],
		trigger: { player: "phaseJudgeBefore" },
		sourceSkill: "qj_shensu",
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(
					get.prompt("qj_shensu"),
					"跳过判定阶段和摸牌阶段，视为对一名其他角色使用一张【杀】",
					function (card, player, target) {
						if (player == target) {
							return false;
						}
						return player.canUse({ name: "sha" }, target, false);
					}
				)
				.set("check", player.countCards("h") > 2)
				.set("ai", function (target) {
					if (!_status.event.check) {
						return 0;
					}
					return get.effect(
						target,
						{ name: "sha" },
						_status.event.player
					);
				})
				.setHiddenSkill(event.skill)
				.forResult();
		},
		async content(event, trigger, player) {
			trigger.cancel();
			player.skip("phaseDraw");
			await player.useCard(
				{ name: "sha", isCard: true },
				event.targets[0],
				false
			);
		},
	},
	qj_shensu_2: {
		audio: "shensu1",
		audioname: ["xiahouba", "re_xiahouyuan", "ol_xiahouyuan"],
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
					prompt2:
						"弃置一张装备牌并跳过出牌阶段，视为对一名其他角色使用一张【杀】",
					filterCard(card, player) {
						return (
							get.type(card) == "equip" &&
							lib.filter.cardDiscardable(card, player)
						);
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
						return get.effect(
							target,
							{ name: "sha" },
							_status.event.player
						);
					},
					check:
						player.countCards("hs", (i) => {
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
			await player.useCard(
				{ name: "sha", isCard: true },
				event.targets[0],
				false
			);
		},
	},
	qj_shensu_3: {
		audio: "shensu1", // TODO: 独立素材，留给后来人
		audioname: ["xiahouba", "re_xiahouyuan", "ol_xiahouyuan"],
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
				.chooseTarget(
					get.prompt("qj_shensu"),
					"失去1点体力并跳过弃牌阶段，视为对一名其他角色使用一张无距离限制的【杀】",
					(card, player, target) =>
						player.canUse("sha", target, false)
				)
				.setHiddenSkill("qj_shensu")
				.set("goon", player.needsToDiscard())
				.set("ai", (target) => {
					/** @type {GameEvent & { goon: number }} */
					const event = cast(get.event());
					const player = get.player();
					if (!event.goon || player.hp <= target.hp) {
						return false;
					}
					return get.effect(
						target,
						{ name: "sha", isCard: true },
						player,
						player
					);
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
	qj_shebian: {
		audio: 2,
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
		audio: 2,
		audioname2: { gz_jun_caocao: "jianan_qiaobian" },
		trigger: {
			player: [
				"phaseJudgeBefore",
				"phaseDrawBefore",
				"phaseUseBefore",
				"phaseDiscardBefore",
			],
		},
		filter(event, player) {
			return player.countCards("he") > 0;
		},
		preHidden: true,
		async cost(event, trigger, player) {
			let check,
				str = "弃置一张牌并跳过";
			str += ["判定", "摸牌", "出牌", "弃牌"][
				lib.skill.qj_qiaobian.trigger.player.indexOf(event.triggername)
			];
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
						if (
							player != players[i] &&
							players[i].countCards("h")
						) {
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
							return (
								get.attitude(player, current) > 0 &&
								current.countCards("j")
							);
						});
						if (!check) {
							if (player.countCards("h") > player.hp + 1) {
								check = false;
							} else if (
								player.countCards("h", { name: "wuzhong" })
							) {
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
				.set("ai", (card) => {
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
			game.log(
				player,
				"跳过了",
				"#y" +
					["判定", "摸牌", "出牌", "弃牌"][
						lib.skill.qiaobian.trigger.player.indexOf(
							event.triggername
						)
					] +
					"阶段"
			);
			if (trigger.name == "phaseUse") {
				if (player.canMoveCard()) {
					await player.moveCard();
				}
			} else if (trigger.name == "phaseDraw") {
				const { result } = await player
					.chooseTarget(
						[1, 2],
						"获得至多两名角色各一张手牌",
						function (card, player, target) {
							return target != player && target.countCards("h");
						}
					)
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
		audio: 2,
		locked: false,
		enable: "chooseToUse",
		filterCard(card) {
			return get.type2(card) != "trick" && get.color(card) == "black";
		},
		filter(event, player) {
			return player.hasCard(
				(card) =>
					get.type2(card) != "trick" && get.color(card) == "black",
				"hes"
			);
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
						return game.hasPlayer((cur) => {
							return (
								cur !== player &&
								lib.filter.judge(card, player, cur) &&
								get.effect(cur, card, player, player) > 0
							);
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
		audio: 2,
		preHidden: true,
		frequent:true,
		filter(event, player) {
			return event.player != player;
		},
		async content(event, trigger, player) {
			await player.draw();
		},
	},
	qj_weikui: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		preHidden: true,
		filterTarget(card, player, target) {
			return target != player && target.countCards("h");
		},
		async cost(event, trigger, player) {
			await player.loseHp();
		},
		async content(event, trigger, player) {
			if (target.countCards("h", "shan")) {
				player.viewHandcards(target);
				if (
					player.canUse({ name: "sha", isCard: true }, target, false)
				) {
					player.useCard(
						{ name: "sha", isCard: true },
						target,
						false
					);
				}
				player.storage.qj_weikui_buff = target;
				player.addTempSkill("qj_weikui_buff");
			} else {
				player
					.discardPlayerCard(target, "visible", true, "h")
					.set("ai", function (button) {
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
		audio: 2,
		trigger: {
			player: "phaseJieshuBegin",
		},
		direct: true,
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
				.chooseTarget(
					get.prompt("lizhan"),
					"令任意名已受伤的角色各摸一张牌",
					[1, Infinity],
					function (card, player, target) {
						return target.isDamaged();
					}
				)
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
		audioname: ["boss_lvbu3"],
		mod: {
			aiOrder(player, card, num) {
				if (
					player.getEquips(1).length ||
					get.subtype(card, player) !== "equip1" ||
					!player.hasSkillTag("noe")
				) {
					return num;
				}
				return 10;
			},
		},
		enable: "phaseUse",
		locked: false,
		filter(event, player) {
			if (
				player.hp < 1 &&
				!player.hasCard(
					(card) => lib.skill.qiangxix.filterCard(card),
					"he"
				)
			) {
				return false;
			}
			return game.hasPlayer((current) =>
				lib.skill.qiangxix.filterTarget(null, player, current)
			);
		},
		filterCard(card) {
			return get.subtype(card) == "equip1";
		},
		position: "he",
		filterTarget(card, player, target) {
			if (target == player) {
				return false;
			}
			var stat = player.getStat()._qiangxix;
			return !stat || !stat.includes(target);
		},
		selectCard() {
			if (_status.event.player.hp < 1) {
				return 1;
			}
			return [0, 1];
		},
		async cost(event, trigger, player) {
			var stat = player.getStat();
			if (!stat._qiangxix) {
				stat._qiangxix = [];
			}
			stat._qiangxix.push(target);
			if (!cards.length) {
				player.loseHp();
			}
		},
		async content(event, trigger, player) {
			event.targets[0].damage("nocard");
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
					return get.effect(
						player,
						{ name: "losehp" },
						player,
						player
					);
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
		audio: 2,
		audioname: ["re_xunyu", "ol_xunyu"],
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
					return get.damageEffect(
						target,
						_status.event.source,
						player
					);
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
						if (
							players[i] != target &&
							players[i] != player &&
							target.inRange(players[i])
						) {
							if (
								get.damageEffect(players[i], target, player) > 0
							) {
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
							max = Math.max(
								Math.min(5, players[i].hp) -
									players[i].countCards("h"),
								max
							);
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
		audio: 2,
		trigger: {
			player: "damageEnd",
		},
		preHidden: true,
		getIndex(event) {
			return event.num;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(
					get.prompt2(event.skill),
					function (card, player, target) {
						return true; //target.countCards('h')<Math.min(target.maxHp,5); // 没有卷入格式化大劫的上古代码碎片喵
					}
				)
				.set("ai", function (target) {
					let att = get.attitude(_status.event.player, target);
					if (target.hasSkillTag("nogain")) {
						att /= 6;
					}
					if (att > 2) {
						return Math.max(
							0,
							Math.min(5, target.maxHp) - target.countCards("h")
						);
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
								max = Math.max(
									Math.min(5, players[i].hp) -
										players[i].countCards("h"),
									max
								);
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
					if (
						(card.name == "tao" || card.name == "caoyao") &&
						target.hp > 1 &&
						target.countCards("h") <= target.hp
					) {
						return [0, 0];
					}
				},
			},
		},
	},
	qj_xingshang: {
		audio: 2,
		audioname2: {
			caoying: "lingren_xingshang",
		},
		trigger: {
			global: "die",
		},
		filter(event, player) {
			return player.isDamaged() || event.player.countCards("he") > 0;
		},
		direct: true,
		preHidden: true,
		frequent:true,
		async cost(event, trigger, player) {
			var choice = [];
			if (player.isDamaged()) {
				choice.push("回复体力");
			}
			if (trigger.player.countCards("he")) {
				choice.push("获得牌");
			}
			choice.push("cancel2");
			player
				.chooseControl(choice)
				.set("prompt", get.prompt2("rexingshang"))
				.set("ai", function () {
					if (choice.length == 2) {
						return 0;
					}
					if (get.value(trigger.player.getCards("he")) > 8) {
						return 1;
					}
					return 0;
				});
		},
		async content(event, trigger, player) {
			if (result.control != "cancel2") {
				player.logSkill(event.name, trigger.player);
				if (result.control == "获得牌") {
					event.togain = trigger.player.getCards("he");
					player.gain(
						event.togain,
						trigger.player,
						"giveAuto",
						"bySelf"
					);
				} else {
					player.recover();
				}
			}
		},
	},
	qj_fangzhu: {
		audio: 2,
		trigger: {
			player: "damageEnd",
		},
		direct: true,
		preHidden: true,
		async cost(event, trigger, player) {
			player.chooseTarget(
				get.prompt2("refangzhu"),
				function (card, player, target) {
					return player != target;
				}
			).ai = function (target) {
				if (target.hasSkillTag("noturn")) {
					return 0;
				}
				var player = _status.event.player;
				if (get.attitude(_status.event.player, target) == 0) {
					return 0;
				}
				if (get.attitude(_status.event.player, target) > 0) {
					if (target.classList.contains("turnedover")) {
						return 1000 - target.countCards("h");
					}
					if (player.getDamagedHp() < 3) {
						return -1;
					}
					return 100 - target.countCards("h");
				} else {
					if (target.classList.contains("turnedover")) {
						return -1;
					}
					if (player.getDamagedHp() >= 3) {
						return -1;
					}
					return 1 + target.countCards("h");
				}
			};
		},
		async content(event, trigger, player) {
			player.logSkill("refangzhu", result.targets);
			event.target = result.targets[0];
			if (player.isHealthy()) {
				event._result = { bool: false };
			} else {
				await event.target
					.chooseToDiscard("he", player.getDamagedHp())
					.set("ai", function (card) {
						var player = _status.event.player;
						if (
							player.isTurnedOver() ||
							_status.event.getTrigger().player.getDamagedHp() > 2
						) {
							return -1;
						}
						return player.hp * player.hp - get.value(card);
					})
					.set(
						"prompt",
						"弃置" +
							get.cnNumber(player.getDamagedHp()) +
							"张牌并失去1点体力；或选择不弃置，将武将牌翻面并摸" +
							get.cnNumber(player.getDamagedHp()) +
							"张牌。"
					);
			}
			if (result.bool) {
				event.target.loseHp();
			} else {
				if (player.isDamaged()) {
					event.target.draw(player.getDamagedHp());
				}
				event.target.turnOver();
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
							if (
								get.attitude(target, players[i]) < 0 &&
								!players[i].isTurnedOver()
							) {
								hastarget = true;
							}
							if (
								get.attitude(target, players[i]) > 0 &&
								players[i].isTurnedOver()
							) {
								hastarget = true;
								turnfriend = true;
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
	qj_xiaoguo: {},
	qj_rende: {},
	qj_wusheng: {},
	qj_paoxiao: {},
	qj_guanxing: {},
	qj_kongcheng: {},
	qj_longdan: {},
	qj_mashu: {},
	qj_tieji: {},
	qj_jizhi: {},
	qj_cangji: {},
	qj_liegong: {},
	qj_kuanggu: {},
	qj_lianhuan: {},
	qj_niepan: {},
	qj_huoji: {},
	qj_bazhen: {},
	qj_kanpo: {},
	qj_xiangle: {},
	qj_fangquan: {},
	qj_huoshou: {},
	qj_zaiqi: {},
	qj_juxiang: {},
	qj_lieren: {},
	qj_shushen: {},
	qj_shenzhi: {},
	qj_zhiheng: {},
	qj_qixi: {},
	qj_keji: {},
	qj_mouduan: {},
	qj_shelie: {},
	qj_kurou: {},
	qj_zhaxiang: {},
	qj_yingzi: {},
	qj_fanjian: {},
	qj_guose: {},
	qj_liuli: {},
	qj_qianxun: {},
	qj_duoshi: {},
	qj_jieyin: {},
	qj_xiaoji: {},
	qj_yinghun: {},
	qj_tianxiang: {},
	qj_hongyan: {},
	qj_tianyi: {},
	qj_hanzhan: {},
	qj_buqu: {},
	qj_fenji: {},
	qj_haoshi: {},
	qj_dimeng: {},
	qj_zhijian: {},
	qj_guzheng: {},
	qj_duanbing: {},
	qj_fenxun: {},
	qj_jishi: {},
	qj_chuli: {},
	qj_wushuang: {},
	qj_xiaomeng: {},
	qj_lijian: {},
	qj_biyue: {},
	qj_luanji: {},
	qj_shuangxiong: {},
	qj_wansha: {},
	qj_luanwu: {},
	qj_weimu: {},
	qj_menghan: {},
	qj_leiji: {},
	qj_guidao: {},
	qj_beige: {},
	qj_duanchang: {},
	qj_xiongyi: {},
	qj_shuangren: {},
	qj_sijian: {},
	qj_suishi: {},
	qj_kuangfu: {},
	qj_huoshui: {},
	qj_qingcheng: {},
	qj_xiaoni: {},
	qj_chuitong: {},
	qj_xingtu: {},
	qj_tairan: {},
	qj_yimie: {},
	qj_choufa: {},
	qj_zhaoran: {},
	qj_tongfa: {},
	qj_beishi: {},
	qj_rouke: {},
	qj_shunliu: {},
	qj_shiren: {},
	qj_jiexia: {},
	qj_yishi: {},
	qj_shidu: {},
	qj_quanbian: {},
	qj_zhouting: {},
	qj_shangshi: {},
	qj_ejue: {},
	qj_guoyi: {},
	qj_ciwei: {},
	qj_caiyuan: {},
	qj_keqing: {},
	qj_lvli: {},
	qj_duoqi: {},
	qj_qianqu: {},
	qj_fuli: {},
	qj_fengwu: {},
	qj_tianming: {},
	qj_mizhao: {},
	qj_shiyuan: {},
	qj_dushi: {},
	qj_taoluan: {},
	qj_mouzhu: {},
	qj_yanhuo: {},
	qj_lianji: {},
	qj_dingzhu: {},
	qj_minsi: {},
	qj_fusong: {},
	qj_zhuikong: {},
	qj_qiuyuan: {},
	qj_moukui: {},
	qj_chengzhao: {},
	qj_aiwu: {},
	qj_juebie: {},
	qj_zhudian: {},
	qj_botong: {},
	qj_fenyue: {},
	qj_jingnu: {},
	qj_weitun: {},
	qj_kannan: {},
	qj_niju: {},
	qj_jibing: {},
	qj_niujin: {},
	qj_zhoucang: {},
	qj_quexiaojiang: {},
	qj_wenhu: {},
	qj_mushun: {},
	qj_huweijun: {},
	qj_baimayicong: {},
	qj_xiangbing: {},
	qj_jinfanjun: {},
	qj_bingzhoulangqi: {},
	qj_huangjinleishi: {},
	qj_fuxinsishi: {},
	qj_xiyuanjun: {},
};

export default skill;
