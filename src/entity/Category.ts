import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";


@Entity()
export class Category {
    constructor(cat: string) {
        this.name = cat
    }

    @PrimaryGeneratedColumn()
    id: number

    @Column()
    name: string
}

Category.prototype.toString = function categoryToString() {
    return this.name
}