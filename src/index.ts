import "reflect-metadata";
import { createConnection, Transaction, Any, FindOperator } from "typeorm";
import Telegraf, { ContextMessageUpdate, Context, Composer } from "telegraf"
// const { Composer } = require("telegraf")
const Extra = require('telegraf/extra')
const Markup = require('telegraf/markup')
import { MoneyTransaction } from "./entity/Transaction";
import { Category } from "./entity/Category";
import { User } from './entity/User'
import { LaterThan, EarlierThan } from "./Date";
import { closestIndexTo } from "date-fns";
const updateLogger = require("telegraf-update-logger")

const TURKISH_LIRA = "\u{20BA}"
type comparisonFunction = (x: Date) => FindOperator<string>
createConnection().then(async connection => {

    let transactionRepository = await connection.getRepository(MoneyTransaction)
    let categoryRepository = await connection.getRepository(Category)
    let userRepository = await connection.getRepository(User)

    const bot = new Telegraf(process.env.BOT_TOKEN || "")
    const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || ""

    bot.use(updateLogger({ colors: true, }))

    const logToAdmin = () => (ctx: ContextMessageUpdate, next) => {
        if (ctx.message) {
            bot.telegram.sendMessage(ADMIN_CHAT_ID, `User = ${ctx.from.first_name}\nMessage = ${ctx.message.text}`)
        }
        return next()
    }
    bot.use(logToAdmin())

    bot.catch((err) => { console.log(err) })

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
                let newMoney = user.money -= t.amount
                userRepository.createQueryBuilder().update().set({ money: newMoney }).where("name = :name", { name: user.name }).execute()
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
    bot.hears(/^[-]\s*(\d+)\s*([\w\sığüşçöIĞÜŞÇÖ]+)?/iu, gider)
    bot.hears(/^(\d+)\s*([\w\sığüşçöIĞÜŞÇÖ]+)*/iu, gider)

    async function gelir(ctx: ContextMessageUpdate) {
        if (ctx.message) {
            // Eğer match[2] yok ise Date tanımlı işlem girilecek
            let date = new Date()
            let amount = parseFloat(ctx.match[1])
            let user = await getUser(ctx)
            if (ctx.match[2] == undefined) {
                let t = new MoneyTransaction(user, true, amount, date)
                transactionRepository.save(t)
                let newMoney = user.money += t.amount
                userRepository.createQueryBuilder().update().set({ money: newMoney }).where("name = :name", { name: user.name }).execute()
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
    bot.hears(/^[+]\s*(\d+)\s*([\w\sığüşçö]+)?/iu, gelir)

    async function currentMoney(ctx: ContextMessageUpdate) {
        if (ctx.message) {
            let user = await getUser(ctx)
            ctx.replyWithMarkdown("Şu anki bakiyeniz: *" + TURKISH_LIRA + user.money + "*\u{1F4B0}")
        }
    }
    bot.command("net", currentMoney)
    bot.hears(/^net$/i, currentMoney)

    async function compareDates(ctx: ContextMessageUpdate, date: Date, f: comparisonFunction) {
        let user = await getUser(ctx)
        let l = await transactionRepository.find({
            transactionDate: f(date),
            user: user
        })
        if (l.length == 0) {
            ctx.reply("Herhangi bir sonuç bulunamadı. \u{1F613}")
            return
        }
        l.forEach(e => {
            ctx.replyWithMarkdown(
                "\u{2663} *" + TURKISH_LIRA + "*" + e.amount + "\n"
                + "\u{2665} *Tanım: *" + e.description + "\n"
                + "\u{2660} *Tarih:*   " + e.transactionDate.toLocaleString("tr-TR"))
        })
    }

    async function afterDate(ctx: ContextMessageUpdate, date: Date) {
        await compareDates(ctx, date, LaterThan)
    }

    async function beforeDate(ctx: ContextMessageUpdate, date: Date) {
        await compareDates(ctx, date, EarlierThan)
    }

    async function afterHour(ctx: ContextMessageUpdate) {
        let m = ctx.message.text
        let arr = m.substr(1).split(":")
        let hour = parseInt(arr[0])
        let min = parseInt(arr[1])
        let currentDate = new Date()
        let queryDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), hour, min, 0)
        await afterDate(ctx, queryDate)
    }
    bot.hears(/^[>]\s*\d{2}[:]\d{2}/iu, afterHour)

    async function beforeHour(ctx: ContextMessageUpdate) {
        let m = ctx.message.text
        let arr = m.substr(1).split(":")
        let hour = parseInt(arr[0])
        let min = parseInt(arr[1])
        let currentDate = new Date()
        let queryDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), hour, min, 0)
        await beforeDate(ctx, queryDate)
    }
    bot.hears(/^[<]\s*\d{2}[:]\d{2}/iu, beforeHour)

    async function afterDay(ctx: ContextMessageUpdate) {
        let message = ctx.message.text
        let day = parseInt(message.substr(1))
        let currentDate = new Date()
        let queryDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
        await afterDate(ctx, queryDate)
    }
    bot.command("after", afterDay)
    bot.hears(/^[>]\s*\d{1,2}$/iu, afterDay)

    async function beforeDay(ctx: ContextMessageUpdate) {
        let message = ctx.message.text
        let day = parseInt(message.substr(1))
        let currentDate = new Date()
        let queryDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
        await beforeDate(ctx, queryDate)
    }
    bot.command("before", beforeDay)
    bot.hears(/^[<]\s*\d{1,2}$/iu, beforeDay)

    async function afterMonth(ctx: ContextMessageUpdate) {
        ctx.reply(ctx.message.text)
    }
    bot.hears(/[>]\w{3}/iu, afterMonth)


    async function todaysTransaction(ctx: ContextMessageUpdate) {
        let currentDate = new Date()
        let queryDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate())
        await afterDate(ctx, queryDate)
        await currentMoney(ctx)
    }
    bot.command("today", todaysTransaction)
    bot.hears(/^today|bug[uü]n$/iu, todaysTransaction)

    //     async function onHelp(ctx: ContextMessageUpdate) {
    //         let str = `
    // Bu bot kolay harcama takibi yapmanıza imkan sağlar.
    // *net*: O anki bakiyenizi gösterir.
    // *today*: O gün yaptığınız işlemleri gösterir.
    // *bugün*: O gün yaptığınız işlemleri gösterir.
    // *[SAYI] [AÇIKLAMA]*: Gider kaydı oluşturulmasını sağlar.
    // *"12 kahve"*
    // *-[SAYI] [AÇIKLAMA]* : Gider kaydı oluşturulmasını sağlar.
    // *"-12 kahve"*
    // *+[SAYI] [AÇIKLAMA]*: Gelir kaydı oluşturulmasını sağlar.
    // *"+500 kyk kredisi"*
    // *>[2 BASAMAKLI SAYI]*: Ayın belirtilen gününden sonraki kayıtları gösterir.
    // *">29"*
    // *>[2 BASAMAKLI SAYI]*:[2 BASAMAKLI SAYI]*: O günkü belirtilen saatten sonraki kayıtları gösterir.
    // *">13:54"*
    // *<[2 BASAMAKLI SAYI]*: Ayın belirtilen gününden önceki kayıtları gösterir.
    // *"<29"*
    // *<[2 BASAMAKLI SAYI]:[2 BASAMAKLI SAYI]*: O günkü belirtilen saatten önceki kayıtları gösterir.
    // *"<13:54"*
    //         `
    //         ctx.replyWithMarkdown(str)
    //     }
    //     bot.command("help", onHelp)

    bot.launch()
}).catch(error => console.log(error));
