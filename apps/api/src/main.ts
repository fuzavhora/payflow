import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api/v1");
  app.enableCors({origin:process.env.WEB_ORIGIN?.split(",").map((value)=>value.trim())??["http://localhost:3000"],credentials:true});
  app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));
  const port=Number(process.env.API_PORT??4000);
  await app.listen(port,"0.0.0.0");
  console.log("PayFlow API listening on port "+port);
}
void bootstrap();
