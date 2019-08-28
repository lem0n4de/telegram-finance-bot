import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, ManyToOne } from "typeorm";
import { Category } from "./Category";
import { User } from "./User";

@Entity()
export class MoneyTransaction {
    constructor(user: User, positive: boolean, amount: number, date: Date, desc: string = "") {
        this.user = user
        this.positive = positive
        this.amount = amount
        this.date = date
        this.description = desc
    }

    @PrimaryGeneratedColumn()
    id: number

    @ManyToOne(type => User, user => user.transactions)
    user: User

    @Column("boolean")
    positive: boolean

    @Column("double")
    amount: number

    @Column()
    date: Date

    @Column({
        nullable : false 
    })
    description : string
}
