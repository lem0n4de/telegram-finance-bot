import "reflect-metadata";
import { createConnection, Transaction, Any } from "typeorm";
import Telegraf, { ContextMessageUpdate } from "telegraf"
const Extra = require('telegraf/extra')
const Markup = require('telegraf/markup')
import { MoneyTransaction } from "./entity/Transaction";
import { Category } from "./entity/Category";
import { User } from './entity/User'

createConnection().then(async connection => {

    let transactionRepository = await connection.getRepository(MoneyTransaction)
    let categoryRepository = await connection.getRepository(Category)
    let userRepository = await connection.getRepository(User)

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

    async function getUser(ctx: ContextMessageUpdate) {
        let user = await userRepository.findOne({ name: ctx.chat.username })
        if (user) {
            return user
        }
        user = new User(ctx.chat.username)
        return await userRepository.save(user)
    }

    async function gider(ctx: ContextMessageUpdate) {
        if (ctx.message) {
            // Eğer match[2] yok ise Date tanımlı işlem girilecek
            let date = new Date()
            let amount = parseFloat(ctx.match[1])
            let user = await getUser(ctx)
            if (ctx.match[2] == undefined) {
                let t = new MoneyTransaction(user, false, amount, date)
                transactionRepository.save(t)
                ctx.reply(ctx.match[1] + " miktarlı " + date.toLocaleString("tr-TR") + " zamanlı işlem kaydedildi. \u{1F44D}")
                return
            }
            let desc = ctx.match[2]
            let t = new MoneyTransaction(user, false, amount, date, desc)
            transactionRepository.save(t)
            let newMoney = user.money -= t.amount
            userRepository.createQueryBuilder().update().set({ money: newMoney }).where("name = :name", { name: user.name }).execute()
            ctx.reply(ctx.match[1] + " miktarlı, " + ctx.match[2] + " tanımlı işlem kaydedildi. \u{1F44D}")
        }
    }
    bot.command("gi", gider)
    bot.hears(/^[-]\s*(\d+)\s*([\w\sığüşçöIĞÜŞÇÖ]+)?/u, gider)
    bot.hears(/^(\d+)\s*([\w\sığüşçöIĞÜŞÇÖ]+)?/u, gider)

    async function gelir(ctx: ContextMessageUpdate) {
        if (ctx.message) {
            // Eğer match[2] yok ise Date tanımlı işlem girilecek
            let date = new Date()
            let amount = parseFloat(ctx.match[1])
            let user = await getUser(ctx)
            if (ctx.match[2] == undefined) {
                let t = new MoneyTransaction(user, true, amount, date)
                transactionRepository.save(t)
                ctx.reply(ctx.match[1] + " miktarlı " + date.toLocaleString("tr-TR") + " zamanlı işlem kaydedildi. \u{1F44D}")
                return
            }
            let desc = ctx.match[2]
            let t = new MoneyTransaction(user, true, amount, date, desc)
            transactionRepository.save(t)
            let newMoney = user.money += t.amount
            userRepository.createQueryBuilder().update().set({ money: newMoney }).where("name = :name", { name: user.name }).execute()
            ctx.reply(ctx.match[1] + " miktarlı, " + ctx.match[2] + " tanımlı işlem kaydedildi. \u{1F44D}")
        }
    }
    bot.command("ge", gelir)
    bot.hears(/^[+]\s*(\d+)\s*([\w\sığüşçöIĞÜŞÇÖ]+)?/u, gelir)

    async function currentMoney(ctx: ContextMessageUpdate) {
        if (ctx.message) {
            let user = await getUser(ctx)
            ctx.replyWithMarkdown("Şu anki bakiyeniz:* \u{20BA}" + user.money + "*")
            //     let gider = await transactionRepository.createQueryBuilder().select("id, amount").where("positive = :p", { p : false}).execute()
            //     let giderSum = 0
            //     gider.forEach(e => {
            //         giderSum += e.amount
            //     });

            //     let gelir = await transactionRepository.createQueryBuilder().select("id, amount").where("positive = :p", { p : true}).execute()
            //     let gelirSum = 0
            //     gelir.forEach(e => {
            //         gelirSum += e.amount
            //     })

            //     let net = gelirSum - giderSum
            //     ctx.reply("Net para = " + "*" + net + "*")
        }
    }
    bot.command("net", currentMoney)
    bot.hears("net", currentMoney)

    bot.launch()
}).catch(error => console.log(error));
