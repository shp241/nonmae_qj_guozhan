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
		audio: "guicai",
		trigger: { global: "judge" },
		preHidden: true,
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
		audio: "fankui",
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
		audio: "qingjian",
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
		audio: "qingzi",
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
		audio: "luoshen",
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
		audio: "shensu1", // TODO: 独立素材，留给后来人
		group: ["qj_shensu_1", "qj_shensu_2", "qj_shensu_3"],
		preHidden: ["qj_hensu_1", "qj_shensu_2", "qj_shensu_3"],
	},
	qj_shensu_1: {
		audio: "shensu1",
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
		audio: "duanliang",
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
		preHidden: true,
		filterTarget(card, player, target) {
			return target != player && target.countCards("h");
		},
		async content(event, trigger, player) {
			await player.loseHp();
			let target = event.target;
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
			if (!stat._qiangxix) {
				stat._qiangxix = [];
			}
			stat._qiangxix.push(event.target);
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
		audio: "fangzhu",
		trigger: {
			player: "damageEnd",
		},
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
	qj_xiaoguo: {
		//TODO
	},
	qj_rende: {
		audio: "qj_rende",
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
				return info[0] == "basic" && player.hasUseTarget(new lib.element.VCard({ name: info[2], nature: info[3] }), null, true);
			});
			if (num < 2 && num + cards.length > 1 && list.length) {
				const { result } = await player.chooseButton(["是否视为使用一张基本牌？", [list, "vcard"]]).set("ai", button => {
					return get.player().getUseValue({ name: button.link[2], nature: button.link[3], isCard: true });
				});
				if (!result?.links?.length) {
					return;
				}
				await player.chooseUseTarget(get.autoViewAs({ name: result.links[0][2], nature: result.links[0][3], isCard: true }), true);
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
						if (player.countCards("e", { subtype: get.subtype(card) })) {
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
		audio: "kongcheng",
		trigger: {
			target: "useCardToTarget",
		},
		locked: true,
		forced: true,
		preHidden: true,
		check(event, player) {
			return get.effect(event.target, event.card, event.player, player) < 0;
		},
		filter(event, player) {
			return player.countCards("h") == 0 && (event.card.name == "sha" || event.card.name == "juedou");
		},
		async content(_event, trigger, player) {
			// @ts-expect-error 类型系统未来可期
			trigger.getParent()?.targets.remove(player);
		},
		onremove(player, skill) {
			const cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
		},
		ai: {
			effect: {
				target(card, _player, target, _current) {
					if (target.countCards("h") == 0 && (card.name == "sha" || card.name == "juedou")) {
						return "zeroplayertarget";
					}
				},
			},
		},
		intro: {
			markcount: "expansion",
			mark(dialog, _content, player) {
				const contents = player.getExpansions("gz_kongcheng");
				if (contents?.length) {
					if (player == game.me || player.isUnderControl(void 0, void 0)) {
						dialog.addAuto(contents);
					} else {
						return "共有" + get.cnNumber(contents.length) + "张牌";
					}
				}
			},
			content(_content, player) {
				const contents = player.getExpansions("gz_kongcheng");
				if (contents && contents.length) {
					if (player == game.me || player.isUnderControl(void 0, void 0)) {
						return get.translation(contents);
					}
					return "共有" + get.cnNumber(contents.length) + "张牌";
				}
			},
		},
		group: ["gz_kongcheng_gain", "gz_kongcheng_got"],
		subSkill: {
			gain: {
				audio: "kongcheng",
				trigger: {
					player: "gainBefore",
				},
				filter(event, player) {
					// @ts-expect-error 类型系统未来可期
					return event.source && event.source != player && player != _status.currentPhase && !event.bySelf && player.countCards("h") == 0;
				},
				async content(_event, trigger, _player) {
					trigger.name = "addToExpansion";
					trigger.setContent("addToExpansion");
					// @ts-expect-error 类型系统未来可期
					trigger.gaintag = ["gz_kongcheng"];
					// @ts-expect-error 类型系统未来可期
					trigger.untrigger();
					trigger.trigger("addToExpansionBefore");
				},
				sub: true,
				forced: true,
			},
			got: {
				trigger: {
					player: "phaseDrawBegin1",
				},
				filter(_event, player) {
					return player.getExpansions("gz_kongcheng").length > 0;
				},
				async content(_event, _trigger, player) {
					player.gain(player.getExpansions("gz_kongcheng"), "draw");
				},
				sub: true,
				forced: true,
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
					await event.targets[0].damage();
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
		}
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
		audio: 2,
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
		//TODO: 藏机
	},
	qj_liegong: {
		audio: "liegong",
		audioname2: { gz_jun_liubei: "shouyue_liegong" },
		locked: false,
		mod: {
			targetInRange(card, player, target) {
				if (card.name == "sha" && target.countCards("h") < player.countCards("h")) {
					return true;
				}
			},
			attackRange(player, distance) {
				if (get.zhu(player, "shouyue")) {
					return distance + 1;
				}
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
			await player
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
				}).forResult();
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
			event.result = { bool: true, skill_popup: false };
		},
		async content(_event, _trigger, _player) { },
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
		//TODO
	},
	qj_bazhen: {
		audio: 2,
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
				audio: 2,
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
			player: "phaseJieshuBegin",
		},
		async cost(event, trigger, player) {
			player.chooseTarget([1, lib.skill.qj_zaiqi.count()], get.prompt2("qj_zaiqi"), target.isFriendOf(player))
				.ai = function (target) {
					return get.attitude(_status.event.player, target);
				};
		},
		async content(event, trigger, player) {
			var targets = event.targets;
			awaittargets.sortBySeat();
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
						}).forResult();
				}
				if (event.result.index == 1) {
					target.line(player);
					player.recover(target);
				} else {
					target.draw();
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
		async cost(event, trigger, player) {
			var cards = player.getCards("h");
			event.bool = cards.length >= player.hp;
			await player.discard(cards);
		},
		async content(event, trigger, player) {
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
		audio: 2,
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
			return suits.length >= 4 || types.length >= 3;
		},
		check(event, player) {
			return player.canMoveCard(true, void 0);
		},
		async content(event, trigger, player) {
			await player.moveCard();
		},
		// TODO: 满足两个条件获得“涉猎”技能；补充 ai
	},
	qj_shelie: {
		audio: 2,
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
			"step 1";
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
			"step 2";
			if (result.bool && result.links) {
				event.cards2 = result.links;
			} else {
				event.finish();
			}
			var time = 1000 - (get.utc() - event.time);
			if (time > 0) {
				game.delay(0, time);
			}
			"step 3";
			game.broadcastAll("closeDialog", event.videoId);
			var cards2 = event.cards2;
			player.gain(cards2, "log", "gain2");
		},
		ai: {
			threaten: 1.2,
		},
	},
	qj_kurou: {
		audio: 2,
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
	// TODO: 修改为乔剪版
	qj_zhaxiang: {
		audio: 2,
		trigger: { player: "loseHpEnd" },
		filter(event, player) {
			return player.isIn() && event.num > 0;
		},
		getIndex: event => event.num,
		forced: true,
		async content(event, trigger, player) {
			await player.draw(3);
			if (player.isPhaseUsing()) {
				player.addTempSkill(event.name + "_effect");
				player.addMark(event.name + "_effect", 1, false);
			}
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
							return num + player.countMark("zhaxiang_effect");
						}
					},
				},
				charlotte: true,
				onremove: true,
				audio: "zhaxiang",
				audioname2: { ol_sb_jiangwei: "zhaxiang_ol_sb_jiangwei" },
				trigger: { player: "useCard" },
				sourceSkill: "zhaxiang",
				filter(event, player) {
					return event.card?.name == "sha" && get.color(event.card) == "red";
				},
				forced: true,
				async content(event, trigger, player) {
					trigger.directHit.addArray(game.players);
				},
				intro: { content: "<li>使用【杀】的次数上限+#<br><li>使用红色【杀】无距离限制且不能被【闪】响应" },
				ai: {
					directHit_ai: true,
					skillTagFilter(player, tag, arg) {
						return arg?.card?.name == "sha" && get.color(arg.card) == "red";
					},
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
						if (using && target.countCards("h", { name: "sha", color: "red" })) {
							return [1, 3];
						}
						return [1, target.countCards("h") <= target.hp || (using && game.hasPlayer(current => current != player && get.attitude(player, current) < 0 && player.inRange(current))) ? 3 : 2];
					}
				},
			},
		},
	},
	qj_yingzi: {
		audio: 2,
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
	// TODO: 主将技
	qj_fanjian: {
		audio: 2,
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
			"step 1";
			var suit = get.suit(target.storage.refanjian);
			if (!target.countCards("h")) {
				event._result = { control: "refanjian_hp" };
			} else {
				target.chooseControl("refanjian_card", "refanjian_hp").ai = function (event, player) {
					var cards = player.getCards("he", { suit: get.suit(player.storage.refanjian) });
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
			"step 2";
			if (result.control == "refanjian_card") {
				target.showHandcards();
			} else {
				target.loseHp();
				event.finish();
			}
			"step 3";
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
		audio: 2,
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
		audio: 2,
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
					const vcard = { name: "shacopy", nature: card.nature, suit: card.suit };
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
		// TODO: "锁定技，你每回合首次成为锦囊牌的目标时，若此牌有其他未指定的合法目标，取消之。"

	},
	qj_duoshi: {
		// TODO: "你可以将本回合未置入过弃牌堆的花色的一张牌当【以逸待劳】使用，然后若均已置入过，你可以令一名小势力角色选择是否将X张红色牌当【火烧连营】使用（X为目标数）。
	},
	qj_jieyin: {
		audio: 2,
		enable: "phaseUse",
		filterCard: true,
		usable: 1,
		position: "he",
		filter(event, player) {
			return player.countCards("he") > 0;
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
			"step 1";
			if (result.index == 0) {
				player.$give(cards, target, false);
				target.equip(cards[0]);
			} else {
				player.discard(cards);
			}
			"step 2";
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
		audio: 2,
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
		// TODO: "当你受到伤害时，你可以弃置一张红桃牌并防止此伤害，然后选择一名其他角色和本回合未选择过的一项：1.来源对其造成1点伤害，然后其摸等同其已损失体力值的牌（至多摸五张）；2.其失去1点体力，然后获得你弃置的牌。"
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
		audio: 2,
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
		// TODO: 锁定技，当你进入濒死状态时，你摸一张牌，然后选择一项：1.将一张牌置于武将牌上（称为“创”，每花色限一张）并回复体力至1点；2.弃置一张牌。
	},
	qj_fenji: {
		// TODO: 每回合结束时，你可以令一名本回合失去过所有手牌的角色摸两张牌，然后你失去1点体力。
	},
	qj_haoshi: {
		audio: 2,
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
		// TODO: 纵横
		audio: 2,
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
			event.targets[0].swapHandcards(event.targets[1]);
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
		audio: 2,
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
		audio: 2,
		trigger: {
			global: ["loseAfter", "loseAsyncAfter"],
		},
		filter(event, player) {
			if (event.type != "discard") {
				return false;
			}
			if (player.hasSkill("olguzheng_used")) {
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
		checkx(event, player, cards) {
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
		direct: true,
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
					.chooseButton(2, [get.prompt("olguzheng", target), '<span class="text center">被选择的牌将成为对方收回的牌</span>', cards, [["获得剩余的牌", "放弃剩余的牌"], "tdnodes"]])
					.set("filterButton", function (button) {
						const type = typeof button.link;
						if (ui.selected.buttons.length && type == typeof ui.selected.buttons[0].link) {
							return false;
						}
						return true;
					})
					.set("check", lib.skill.olguzheng.checkx(trigger, player, cards))
					.set("ai", function (button) {
						if (typeof button.link == "string") {
							return button.link == "获得剩余的牌" ? 1 : 0;
						}
						if (_status.event.check) {
							return 20 - get.value(button.link, _status.event.getTrigger().player);
						}
						return 0;
					})
					.setHiddenSkill("olguzheng")
					.forResult();
				if (result?.links) {
					player.logSkill("olguzheng", target);
					const links = result.links;
					player.addTempSkill("olguzheng_used", "phaseJieshuAfter");
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
		audio: 2,
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
