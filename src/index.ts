import "reflect-metadata";
import { createConnection, Transaction, Any, FindOperator } from "typeorm";
import Telegraf, { ContextMessageUpdate } from "telegraf";
const Extra = require("telegraf/extra");
const Markup = require("telegraf/markup");
import { MoneyTransaction } from "./entity/Transaction";
import { Category } from "./entity/Category";
import { User } from "./entity/User";
import { LaterThan, EarlierThan } from "./Date";
import { closestIndexTo } from "date-fns";
const updateLogger = require("telegraf-update-logger");

const TURKISH_LIRA = "\u{20BA}";
const START_TEXT = `
Cüzdanım botuna hoşgeldiniz. Herhangi bir komut hakkında yardım almak için */help **komut adı** * yazabilirsiniz.
`;
type comparisonFunction = (x: Date) => FindOperator<string>;
createConnection()
  .then(async connection => {
    let transactionRepository = await connection.getRepository(
      MoneyTransaction
    );
    let categoryRepository = await connection.getRepository(Category);
    let userRepository = await connection.getRepository(User);

    const bot = new Telegraf(process.env.BOT_TOKEN || "");
    const loggerBot = new Telegraf(process.env.LOGGER_BOT_TOKEN || "");
    const LOGGING_CHAT_ID = process.env.LOG_CHAT_ID || "";

    bot.use(updateLogger({ colors: true }));

    function log(msg: string) {
      loggerBot.telegram.sendMessage(LOGGING_CHAT_ID, msg);
    }

    bot.use(async (ctx, next) => {
      next();
      let message = ctx.message.text;
      let user = await getUser(ctx);
      log(`
FROM ----- ${user.name}
MESSAGE ----- ${message}
CURRENT MONEY ----- ${user.money}
`);
    });

    bot.catch(err => {
      console.log(err);
      log(`Bir hata oluştu: \n ${err}`);
    });

    function stripCommand(str: string) {
      if (str.startsWith("/")) {
        let strs = str.split(" ");
        strs.reverse().pop();
        return strs.reverse().join(" ");
      }
    }

    async function newCategory(ctx: ContextMessageUpdate) {
      if (ctx.message) {
        let str = stripCommand(ctx.message.text);
        let cat = new Category(str);
        categoryRepository.save(cat);
        ctx.reply("Yeni kategori eklendi \u{2714}");
      }
    }
    bot.command("nc", newCategory);

    async function getCategories(ctx: ContextMessageUpdate) {
      let cats = await categoryRepository.find();
      let replyString = "";
      cats.forEach((v, i, a) => {
        replyString += "*" + (i + 1) + ".* " + v.toString() + "\n";
      });
      ctx.replyWithMarkdown(replyString);
    }
    bot.command("gc", getCategories);

    async function removeCategories(ctx: ContextMessageUpdate) {
      if (ctx.message) {
        let num = parseInt(stripCommand(ctx.message.text));
        categoryRepository
          .createQueryBuilder()
          .delete()
          .where("id=:id", { id: num })
          .execute();
        ctx.replyWithMarkdown("*Kategori* " + num + " silindi.");
      }
    }
    bot.command("rc", removeCategories);

    async function getUser(ctx: ContextMessageUpdate) {
      let user = await userRepository.findOne({ name: ctx.from.first_name });
      if (user) {
        console.log(`Found a user with username ${user.name}`);
        return user;
      }
      user = new User(ctx.from.first_name);
      console.log(`New user = ${user}`);
      return await userRepository.save(user);
    }

    bot.command("start", async ctx => {
      let user = new User(ctx.from.first_name);
      ctx.reply("Hoşgeldin " + user.name + ".");
      ctx.replyWithMarkdown(START_TEXT);
      return await userRepository.save(user);
    });

    async function gider(ctx: ContextMessageUpdate) {
      if (ctx.message) {
        // Eğer match[2] yok ise Date tanımlı işlem girilecek
        let date = new Date();
        let amount = parseFloat(
          ctx.match[1].replace(/\./g, "").replace(",", ".")
        );
        console.log(amount);
        let user = await getUser(ctx);
        if (ctx.match[2] == undefined) {
          let t = new MoneyTransaction(user, false, amount, date);
          transactionRepository.save(t);
          ctx.reply(
            ctx.match[1] +
              " miktarlı " +
              date.toLocaleString("tr-TR") +
              " zamanlı işlem kaydedildi. \u{1F44D}"
          );
          let newMoney = (user.money -= t.amount);
          console.log(` Net money is ${newMoney}`);
          userRepository
            .createQueryBuilder()
            .update()
            .set({ money: newMoney })
            .where("name = :name", { name: user.name })
            .execute();
          return;
        }
        let desc = ctx.match[2];
        let t = new MoneyTransaction(user, false, amount, date, desc);
        transactionRepository.save(t);
        let newMoney = (user.money -= t.amount);
        userRepository
          .createQueryBuilder()
          .update()
          .set({ money: newMoney })
          .where("name = :name", { name: user.name })
          .execute();
        ctx.reply(
          ctx.match[1] +
            " miktarlı, " +
            ctx.match[2] +
            " tanımlı işlem kaydedildi. \u{1F44D}"
        );
      }
    }
    bot.command("gi", gider);
    bot.hears(/^[-]\s*([\d,.]+)\s*([\w\sığüşçöIĞÜŞÇÖ]+)?/iu, gider);
    bot.hears(/^([\d,.]+)\s*([\w\sığüşçöIĞÜŞÇÖ]+)*$/iu, gider);

    async function gelir(ctx: ContextMessageUpdate) {
      if (ctx.message) {
        // Eğer match[2] yok ise Date tanımlı işlem girilecek
        let date = new Date();
        let amount = parseFloat(
          ctx.match[1].replace(/\./g, "").replace(",", ".")
        );
        let user = await getUser(ctx);
        if (ctx.match[2] == undefined) {
          let t = new MoneyTransaction(user, true, amount, date);
          transactionRepository.save(t);
          let newMoney = (user.money += t.amount);
          userRepository
            .createQueryBuilder()
            .update()
            .set({ money: newMoney })
            .where("name = :name", { name: user.name })
            .execute();
          ctx.reply(
            ctx.match[1] +
              " miktarlı " +
              date.toLocaleString("tr-TR") +
              " zamanlı işlem kaydedildi. \u{1F44D}"
          );
          return;
        }
        let desc = ctx.match[2];
        let t = new MoneyTransaction(user, true, amount, date, desc);
        transactionRepository.save(t);
        let newMoney = (user.money += t.amount);
        userRepository
          .createQueryBuilder()
          .update()
          .set({ money: newMoney })
          .where("name = :name", { name: user.name })
          .execute();
        ctx.reply(
          ctx.match[1] +
            " miktarlı, " +
            ctx.match[2] +
            " tanımlı işlem kaydedildi. \u{1F44D}"
        );
      }
    }
    bot.command("ge", gelir);
    bot.hears(/^[+]\s*([\d,.]+)\s*([\w\sığüşçö]+)?/iu, gelir);

    async function currentMoney(ctx: ContextMessageUpdate) {
      if (ctx.message) {
        let user = await getUser(ctx);
        ctx.replyWithMarkdown(
          "Şu anki bakiyeniz: *" + TURKISH_LIRA + user.money + "*\u{1F4B0}"
        );
      }
    }
    bot.command("net", currentMoney);
    bot.hears(/^net$/i, currentMoney);

    async function compareDates(
      ctx: ContextMessageUpdate,
      date: Date,
      f: comparisonFunction
    ) {
      let user = await getUser(ctx);
      let l = await transactionRepository.find({
        transactionDate: f(date),
        user: user
      });
      if (l.length == 0) {
        ctx.reply("Herhangi bir sonuç bulunamadı. \u{1F613}");
        return;
      }
      l.forEach(e => {
        ctx.replyWithMarkdown(
          "\u{2663} *" +
            TURKISH_LIRA +
            "*" +
            e.amount +
            "\n" +
            "\u{2665} *Tanım: *" +
            e.description +
            "\n" +
            "\u{2660} *Tarih:*   " +
            e.transactionDate.toLocaleString("tr-TR")
        );
      });
    }

    async function afterDate(ctx: ContextMessageUpdate, date: Date) {
      await compareDates(ctx, date, LaterThan);
    }

    async function beforeDate(ctx: ContextMessageUpdate, date: Date) {
      await compareDates(ctx, date, EarlierThan);
    }

    async function afterHour(ctx: ContextMessageUpdate) {
      let m = ctx.message.text;
      let arr = m.substr(1).split(":");
      let hour = parseInt(arr[0]);
      let min = parseInt(arr[1]);
      let currentDate = new Date();
      let queryDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        currentDate.getDate(),
        hour,
        min,
        0
      );
      await afterDate(ctx, queryDate);
    }
    bot.hears(/^[>]\s*\d{2}[:]\d{2}/iu, afterHour);

    async function beforeHour(ctx: ContextMessageUpdate) {
      let m = ctx.message.text;
      let arr = m.substr(1).split(":");
      let hour = parseInt(arr[0]);
      let min = parseInt(arr[1]);
      let currentDate = new Date();
      let queryDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        currentDate.getDate(),
        hour,
        min,
        0
      );
      await beforeDate(ctx, queryDate);
    }
    bot.hears(/^[<]\s*\d{2}[:]\d{2}/iu, beforeHour);

    async function afterDay(ctx: ContextMessageUpdate) {
      let message = ctx.message.text;
      let day = parseInt(message.substr(1));
      let currentDate = new Date();
      let queryDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        day
      );
      await afterDate(ctx, queryDate);
    }
    bot.command("after", afterDay);
    bot.hears(/^[>]\s*\d{1,2}$/iu, afterDay);

    async function beforeDay(ctx: ContextMessageUpdate) {
      let message = ctx.message.text;
      let day = parseInt(message.substr(1));
      let currentDate = new Date();
      let queryDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        day
      );
      await beforeDate(ctx, queryDate);
    }
    bot.command("before", beforeDay);
    bot.hears(/^[<]\s*\d{1,2}$/iu, beforeDay);

    async function afterMonth(ctx: ContextMessageUpdate) {
      ctx.reply(ctx.message.text);
    }
    bot.hears(/[>]\w{3}/iu, afterMonth);

    async function todaysTransaction(ctx: ContextMessageUpdate) {
      let currentDate = new Date();
      let queryDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        currentDate.getDate()
      );
      await afterDate(ctx, queryDate);
      await currentMoney(ctx);
    }
    bot.command("today", todaysTransaction);
    bot.hears(/^today|bug[uü]n$/iu, todaysTransaction);

    async function onEditBalance(ctx: ContextMessageUpdate) {
      let command = stripCommand(ctx.message.text);
      if (!command) {
        ctx.reply("HATA!!! LÜTFEN TEKRAR DENE! \u{1F916}");
        return;
      }
      let balance = parseFloat(command.replace(/\./g, "").replace(",", "."));
      if (!balance) {
        ctx.reply("LÜTFEN SAYI GİRER MİSİNİZ??? \u{1F620}");
        return;
      }
      let user = await getUser(ctx);
      userRepository
        .createQueryBuilder()
        .update()
        .set({ money: balance })
        .where("id = :userId", { userId: user.id })
        .execute();
      ctx.reply("İşleminiz başarıyla gerçekleştirildi.");
      return await currentMoney(ctx);
    }
    bot.command("bakiyeduzelt", onEditBalance);

    async function onHelp(ctx: ContextMessageUpdate) {
      let command = stripCommand(ctx.message.text);
      if (!command) {
        ctx.replyWithMarkdown("Kullanım: /help _komut adı_");
        return;
      }
      /* create a new command let command = "something" */

      let commandsList = [
        /* Add command command here */
      ];
      if (!commandsList.includes(command)) {
        ctx.reply(
          "Bilinmeyen bir komut girildi. Lütfen tekrar deneyiniz. ¯\\_(ツ)_/¯"
        );
      }
      switch (command) {
        case "": // Check for each command here
          break;
      }
    }
    bot.command("help", onHelp);

    bot.launch();
  })
  .catch(error => console.log(error));
