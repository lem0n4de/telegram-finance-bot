import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from "typeorm";
import { Category } from "./Category";

@Entity()
export class MoneyTransaction {
    constructor(positive: Boolean, amount: number, cat: Category) {
        this.positive = positive
        this.amount = amount
        this.category = cat
    }

    @PrimaryGeneratedColumn()
    id: number

    @Column("boolean")
    positive: Boolean

    @Column("double")
    amount: number

    @OneToOne(type => Category)
    @JoinColumn()
    category: Category
}
