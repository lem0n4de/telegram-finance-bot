import "reflect-metadata";
import { createConnection, Transaction } from "typeorm";
import Telegraf, { ContextMessageUpdate } from "telegraf"
const Extra = require('telegraf/extra')
const Markup = require('telegraf/markup')
import { MoneyTransaction } from "./entity/Transaction";
import { Category } from "./entity/Category";

createConnection().then(async connection => {

    let transactionRepository = await connection.getRepository(MoneyTransaction)
    let categoryRepository = await connection.getRepository(Category)

    const bot = new Telegraf(process.env.BOT_TOKEN || "")

    bot.use(Telegraf.log())

    function stripCommand(str: string) {
        if (str.startsWith("/")) {
            let strs = str.split(" ")
            strs.reverse().pop()
            return strs.reverse().join(" ")
        }
    }
    async function newCategory(ctx: ContextMessageUpdate) {
        if (ctx.message) {
            let str = stripCommand(ctx.message.text)
            let cat = new Category(str)
            categoryRepository.save(cat)
            ctx.reply("Yeni kategori eklendi \u{2714}")
        }
    }
    bot.command("nc", newCategory)

    async function getCategories(ctx: ContextMessageUpdate) {
        let cats = await categoryRepository.find()
        let replyString = ""
        cats.forEach((v, i, a) => {
            replyString += "*" + (i + 1) + ".* " + v.toString() + "\n"
        })
        ctx.replyWithMarkdown(replyString)
    }
    bot.command("gc", getCategories)

    async function removeCategories(ctx: ContextMessageUpdate) {
        if (ctx.message) {
            let num = parseInt(stripCommand(ctx.message.text))
            categoryRepository.createQueryBuilder()
                .delete()
                .where("id=:id", { id: num })
                .execute()
            ctx.replyWithMarkdown("*Kategori* " + num + " silindi.")
        }
    }
    bot.command("rc", removeCategories)

    async function gider(ctx: ContextMessageUpdate) {
        if (ctx.message) {
            console.log(JSON.stringify(ctx))
        }
    }
    bot.command("gider", gider)

    async function gelir(ctx: ContextMessageUpdate) { }
    bot.command("gelir", gelir)

    bot.launch()

    // console.log("Inserting a new user into the database...");
    // const user = new User();
    // user.firstName = "Timber";
    // user.lastName = "Saw";
    // user.age = 25;
    // await connection.manager.save(user);
    // console.log("Saved a new user with id: " + user.id);

    // console.log("Loading users from the database...");
    // const users = await connection.manager.find(User);
    // console.log("Loaded users: ", users);

    // console.log("Here you can setup and run express/koa/any other framework.");

}).catch(error => console.log(error));
