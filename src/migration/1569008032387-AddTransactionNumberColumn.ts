import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  getConnection,
  Transaction
} from "typeorm";
import { MoneyTransaction } from "../entity/Transaction";
import { User } from "../entity/User";

export class AddTransactionNumberColumn1569008032387
  implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(
      "ALTER TABLE money_transaction ADD COLUMN transactionNumber INTEGER NOT NULL DEFAULT 0"
    );

    let con = await getConnection();
    let users = await con.getRepository(User).find();
    for (const user of users) {
      let ts = await con
        .getRepository(MoneyTransaction)
        .find({ where: { user: user }, order: { id: "ASC" } });
      let latestNumber = 0;
      ts.forEach((val, i) => {
        con
          .getRepository(MoneyTransaction)
          .createQueryBuilder()
          .update()
          .set({ transactionNumber: latestNumber + 1 })
          .where({ id: val.id })
          .execute();
        latestNumber += 1;
      });
    }
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    queryRunner.dropColumn("money_transaction", "transactionNumber");
  }
}
