import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm";
import { MoneyTransaction } from "./Transaction";

@Entity()
export class User {
    constructor(name: string, money : number = 0) {
        this.name = name
        this.money = money
    }
    @PrimaryGeneratedColumn()
    id: number


    @Column()
    name : string

    @Column()
    money : number

    @OneToMany(type => MoneyTransaction, transaction => transaction.user)
    transactions : MoneyTransaction[]
}