import { MoreThan, LessThan } from "typeorm";
import { format } from "date-fns";

const DATE_FORMAT = 'yyyy-MM-dd HH:MM:SS'
export const EarlierThan = (date: Date) => LessThan(format(date, DATE_FORMAT))
export const LaterThan = (date: Date) => MoreThan(format(date, DATE_FORMAT))