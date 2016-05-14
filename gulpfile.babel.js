import gulp from "gulp";
import babel from 'gulp-babel'
import del from 'del';

gulp.task('build', () => {
    // del(['dist/**', '!dist']);
    return gulp.src('src/**.js')
        .pipe(babel({
            presets: ['es2015']
        }))
        .pipe(gulp.dest('dist'));
});


// watch, build, serve
gulp.task('watch', ['build'], () => {

    gulp.watch('src/**.*', ['build']);
});

gulp.task('default', ['build']);
