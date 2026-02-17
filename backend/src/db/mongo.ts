import mongoose from "mongoose";
import { env } from "../config/env";

let connected = false;

export const connectMongo = async (): Promise<void> => {
  if (connected) {
    return;
  }

  await mongoose.connect(env.mongoUrl, {
    autoIndex: true
  });

  connected = true;
};
