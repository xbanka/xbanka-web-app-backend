import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@libsql/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    constructor() {
        const libsql = createClient({
            url: process.env.DATABASE_URL as string,
        });
        const adapter = new PrismaLibSql(libsql);
        super({ adapter });
    }

    async onModuleInit() {
        await this.$connect();
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }
}
