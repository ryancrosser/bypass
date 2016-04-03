import gulp from "gulp";
import babel from 'gulp-babel'

gulp.task('build', () => {
    return gulp.src('src/index.js')
        .pipe(babel({
            presets: ['es2015']
        }))
        .pipe(gulp.dest('dist'));
});


// watch, build, serve
gulp.task('watch', () => {
    gulp.watch('src/**', ['build']);
});

gulp.task('default', ['build']);