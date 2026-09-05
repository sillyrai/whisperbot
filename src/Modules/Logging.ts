import chalk from "chalk";

function getDate() { // YYYY-MM-DD HH:MM:SS
    let date = new Date();
    let year = date.getFullYear();
    let month = String(date.getMonth() + 1).padStart(2, '0');
    let day = String(date.getDate()).padStart(2, '0');
    let hours = String(date.getHours()).padStart(2, '0');
    let minutes = String(date.getMinutes()).padStart(2, '0');
    let seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export default {
    info: (message: string) => {
        console.log(chalk.gray(`${getDate()}\t${chalk.blue("INF")}\t${chalk.white(message)}`));
    },

    debug: (message: string) => {
        if (process.env.VERBOSE_LOGGING === "true") {
            console.log(chalk.gray(`${getDate()}\t${chalk.green("DBG")}\t${chalk.white(message)}`));
        }
    },

    warn: (message: string) => {
        console.log(chalk.gray(`${getDate()}\t${chalk.yellow("WRN")}\t${chalk.white(message)}`));
    },
    
    error: (message: string) => {
        console.log(chalk.gray(`${getDate()}\t${chalk.red("ERR")}\t${chalk.white(message)}`));
    },

    fatal: (message: string) => {
        console.log(chalk.gray(`${getDate()}\t${chalk.bgRed("FTL")}\t${chalk.white(message)}`));
    }
}