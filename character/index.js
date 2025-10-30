import { game } from "../../../noname.js";
import character from "./character.js";
import skill from "./skill.js";
import translate from "./translate.js";

game.import("character", function () {
  return {
    name: "qj",
    character,
    skill,
    translate,
  };
});