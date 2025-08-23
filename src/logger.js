import chalk from "chalk";
import { PROGRAM_NAME } from "../data/config.js";

const prefix = chalk.green(`${process.pid}| ${PROGRAM_NAME}`);

export const error = (message, error="") => {
    console.log(`${prefix} | ${chalk.red("ERROR")} | ❌ ${chalk.red(message)}`, error)
}

export const info = (message) => {
    console.log(`${prefix} | ${chalk.blue("INFO ")} | ${chalk.white("" + message)}`)
}