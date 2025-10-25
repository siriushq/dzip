///<reference path="./node_modules/@types/node/index.d.ts"/>
///<reference path="./node_modules/chalk/source/index.d.ts"/>

import { accessSync, statSync, writeFileSync, PathLike, Stats } from "fs";
import chalk from "chalk";
import strip from "strip-ansi";
import create from "prompt-sync";
import Zip from "adm-zip";
import treeify from "treeify";

/** Exits the program. */
const exit = (code: number): true => process.exit(code);

/** Sends an invalid usage message and kills the program. */
const invalidUsage = (): void => {
	console.log(chalk.redBright("Usage: dzip <first> <second> [-t, -tree]"));
	console.log(chalk.redBright("       [-t, -tree] Renders differences in a tree instead of a list."));
	console.log(chalk.redBright("Example: dzip test.zip different.zip"));
	console.log(chalk.yellowBright.italic("Minimal tool for comparing the difference between ZIP archives."));
	exit(-1);
}

/** Check if the provided directory exists, and throw an error if not. */
const assertDirectory = (...paths: PathLike[]): void => {
	paths.forEach((path: PathLike) => {
		try {
			accessSync(path);
		} catch (error) {
			console.log(chalk.redBright(`A fatal error has occurred while attempting to access the first path (${error.message}).`));
			console.log("");
			invalidUsage();
		}
	});
}

/** Creates a tree representation from the provided list of "/" seperated paths. */
const tree = (paths: string[]): string => {
	const result = {};
	paths.forEach(path => {
		const parts: string[] = path.split("/").map(part => chalk.blueBright(part));
		let current = result;
		parts.forEach(part => {
			if (!current[part]) current[part] = {};
			current = current[part];
		})

		const leaf = parts[parts.length - 1];
		current[leaf] = null;
	});
	return treeify.asTree(result, true);
}

/** Return the file size for the provided file. */
const getSize = (path: PathLike): number | bigint => {
	const stats: Stats = statSync(path);
	return stats.size;
}

if (process.argv.length != 4 && process.argv.length != 5) invalidUsage();
let usingTree: boolean = (process.argv.length == 5 && process.argv[4].startsWith("-t"));
assertDirectory(process.argv[2], process.argv[3]);

const prompt: (message: string) => string = create();
const first: string[] = new Zip(process.argv[2]).getEntries().map(entry => entry.entryName);
const second: string[] = new Zip(process.argv[3]).getEntries().map(entry => entry.entryName);

const difference: string[] = first.filter(string => !second.includes(string)).concat(second.filter(string => !first.includes(string)));
if (difference.length == 0) {
	console.log(chalk.redBright("There is no structural difference between the provided archives."));
	console.log((getSize(process.argv[2]) != getSize(process.argv[3])) ? chalk.yellowBright("However, they do not have the same file size.") : chalk.redBright("They also have the same file size."));
	exit(0);
}

if (difference.length > 100) {
	console.log(chalk.redBright(`There are over 100 differences between the provided archives (${difference.length}).`));
	console.log(chalk.gray(`Type ${chalk.blueBright("Y")} to print them all out here, ${chalk.blueBright("E")} to print to a text document, and ${chalk.blueBright("N")} to cancel and quit.`));
	const answer: string = prompt(chalk.gray("> "));
	console.log("");
	switch (answer.toLowerCase()) {
		case "Y":
			break;
		case "E":
			writeFileSync("./difference.txt", usingTree ? strip(tree(difference)) : difference.join("\n"));
			console.log(chalk.yellowBright("Printed to \"difference.txt\"."));
			exit(0);
			break;
		case "N":
			console.log(chalk.redBright("Exiting..."));
			exit(0);
			break;
		default:
			console.log(chalk.redBright("That is not a valid option!"));
			console.log(chalk.redBright("Exiting..."));
			exit(-1);
			break;
	}
}

console.log(chalk.yellowBright(`There are ${difference.length} differences between the provided archives.`));
console.log(chalk.gray.italic(usingTree ? tree(difference) : difference.join("\n")));
exit(0);