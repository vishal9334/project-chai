import dotenv from "dotenv";
import connectDB from "./db/db.js";
import {app} from "./app.js"
dotenv.config({
  path: "./env",
});

connectDB()
  .then(() => {
    app.listen(process.env.PORT || 3000, ()=> console.log(`server is running at PORT ${process.env.PORT}`),
    console.log("mongoDB connected successfull!"))
  })
  .catch((err) => console.log("mongoDB connection failed !!!", err));












  // Aproch first of connect with database
/*
import express from "express";
const app = express()(async () => {
  try {
    await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
    app.on("error", (error) => {
      console.log("ERROR:", error);
      throw error;
    }); 
    app.listen(process.env.PORT, () => {
      console.log(`App is listning on port ${process.env.PORT}`);
    });
  } catch (error) {
    console.log("ERROR", error);
    throw error;
  }
})();
*/
