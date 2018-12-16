mkdir client && cd client
yarn init
yarn add webpack webpack-dev-server vue
touch webpack.config.js
add scripts to package.json
mkdir src www
touch src/index.js src/App.vue www/index.html

yarn add --dev eslint eslint-plugin-import eslint-config-airbnb-base prettier eslint-config-prettier eslint-plugin-prettier
yarn add --dev eslint-config-airbnb eslint-plugin-flowtype eslint-plugin-import eslint-plugin-jsx-a11y
yarn add --dev babel babel-core babel-eslint babel-loader babel-preset-env
yarn add --dev @babel/core
yarn add --dev node-sass css-loader sass-loader style-loader url-loader vue-style-loader
yarn add babel-polyfill
yarn add --dev vue-loader
yarn add vue vuex vue-router
yarn add vue-template-compiler --dev


./node_modules/.bin/webpack
yarn start
