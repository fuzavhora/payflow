import { Test } from "@nestjs/testing";
import { HealthController } from "./health.controller";
import { PrismaService } from "../prisma/prisma.service";

describe("HealthController", () => {
  it("reports healthy when the database query succeeds", async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ result: 1 }]) };
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile();

    const controller = moduleRef.get(HealthController);
    const result = await controller.getHealth();

    expect(result.status).toBe("ok");
    expect(result.dependencies.database).toBe("ok");
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("returns service unavailable when the database query fails", async () => {
    const prisma = { $queryRaw: jest.fn().mockRejectedValue(new Error("database unavailable")) };
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile();

    const controller = moduleRef.get(HealthController);
    await expect(controller.getHealth()).rejects.toMatchObject({ status: 503 });
  });
});
