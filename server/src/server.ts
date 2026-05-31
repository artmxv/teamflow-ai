import { app } from "./app.js";
import { env } from "./config/env.js";

app.listen(env.PORT, () => {
  console.log(`TeamFlow API running at http://localhost:${env.PORT}`);
});
