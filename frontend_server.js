const path = require("path");
const express = require("express");
const nunjucks = require("nunjucks");
require("dotenv").config();

const app = express();
const PORT = Number(process.env.PORT || 4020);
const API_BASE_URL = process.env.API_BASE_URL || "";

const templatesPath = path.join(__dirname, "templates");
const staticPath = path.join(__dirname, "static");

app.use("/static", express.static(staticPath));

nunjucks.configure(templatesPath, {
  autoescape: true,
  express: app,
  noCache: true,
});

const renderTemplate = (res, name) => {
  res.render(name, { api_base_url: API_BASE_URL });
};

const routes = [
  ["/", "index.html"],
  ["/login", "login.html"],
  ["/register", "register.html"],
  ["/404", "404.html"],
  ["/show_essay", "show_essay.html"],
  ["/hw1_writing_setup", "hw1_writing_setup.html"],
  ["/hw1_writing", "hw1_writing.html"],
  ["/hw2_writing_setup", "hw2_writing_setup.html"],
  ["/hw2_writing", "hw2_writing.html"],
  ["/test1_writing", "test1_writing.html"],
  ["/test2_writing", "test2_writing.html"],
  ["/hw_writing_setup_instruct", "hw_writing_setup_instruct.html"],
  ["/hw_writing_instruct", "hw_writing_instruct.html"],
  ["/teacher_index", "teacher_index.html"],
  ["/predict_test", "predict_test.html"],
];

routes.forEach(([route, template]) => {
  app.get(route, (req, res) => renderTemplate(res, template));
});

app.listen(PORT, () => {
  console.log(`Frontend server running on port ${PORT}`);
});
