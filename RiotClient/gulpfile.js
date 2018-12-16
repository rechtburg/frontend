'use strict';

const gulp            = require('gulp');
const sass            = require('gulp-sass');
const pug             = require('gulp-pug');
const rename          = require('gulp-rename');
const babel           = require('gulp-babel');
const uglify          = require('gulp-uglify');
const browserify      = require('browserify');
const riotify         = require('riotify');
const source          = require('vinyl-source-stream');
const browsersync     = require("browser-sync");
const convertEncoding = require('gulp-convert-encoding');
const plumber         = require('gulp-plumber');

/*
 * Sass
 */
gulp.task('sass', function(){
  gulp.src('./src/tag/**/*.scss')
  .pipe(plumber())
  .pipe(sass({outputStyle: 'expanded'}))
  .pipe(convertEncoding({to: "utf-8"}))
  .pipe(gulp.dest('dist/css'))
  .pipe(browsersync.stream());
});

/*
* pug
*/
gulp.task('pug', function(){
  gulp.src(['./src/**.pug', '!.src/_*.pug'])
    .pipe(plumber())
    .pipe(pug({
      pretty: true
    }))
    .pipe(gulp.dest('dist/'));
});

/*
 * riot
 */
gulp.task('concat', function () {
  return browserify({
    debug: true,
    entries: ['./src/main.js']
  }).transform(riotify, { template: 'pug', ext: 'tag.pug' })
    .bundle()
    .on('error', function (err) {
      console.log(err.toString());
      this.emit('end');
    })
    .pipe(source('main.bundle.js'))
    .pipe(gulp.dest('dist/'))
    .pipe(browsersync.stream());
});

/*
 * babel + uglify 
 */
gulp.task('minify', ['concat'], function () {
  return gulp.src('dist/main.bundle.js')
    .pipe(plumber())
    .pipe(babel({
      presets: ["@babel/preset-env"]
    }))
    .pipe(uglify())
    .pipe(rename({
      extname: '.min.js'
    }))
    .pipe(gulp.dest('dist/'))
});

/*
 * BrowserSync
 */
gulp.task('server', function () {
  browsersync.init({
    port: 8080,
    server: {
      baseDir: 'dist',
    },
    open: false,
  });
 });
 
 
 /*
  * Watch
  */
 gulp.task('default', ['server','pug', 'minify', 'sass'], function() {
   gulp.watch("./dist/*", function() {
     browsersync.reload();
   });
   gulp.watch("./src/**/*.js", ['minify']);
   gulp.watch("./src/**/*.tag.pug", ['minify']);
   gulp.watch("./src/**/*.scss", ['sass']);
   gulp.watch("./src/**.pug", ['pug']);
 });
