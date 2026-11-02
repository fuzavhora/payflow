import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
@Controller("health")
export class HealthController {
  constructor(private readonly prisma:PrismaService){}
  @Get()
  async getHealth(){
    const checkedAt=new Date().toISOString();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {status:"ok",service:"payflow-api",dependencies:{database:"ok"},checkedAt};
    } catch {
      throw new ServiceUnavailableException({status:"degraded",service:"payflow-api",dependencies:{database:"unavailable"},checkedAt});
    }
  }
}
