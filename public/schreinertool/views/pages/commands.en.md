# schreinertool Reference

This page describes the properties of the drawing language. A project consists of text lines. The first line describes the project, every following line describes a cabinet or a part.

## Basic Form

`projectname mat.19,wh` - project line with name and material.

`a p.sl,sr,bo,de,rw,eb breit.80 tief.40 hoch.72` - cabinet `a` with parts, width, depth and height.

`b dock.a,,0_b,,3 breit.40 tief.40 hoch.72` - cabinet `b`, connected to cabinet `a`.

A line starts with the name, followed by properties.

`a breit.80 tief.40 hoch.72` - cabinet `a` with explicit dimensions.

Many properties have short forms. These two lines mean the same thing:

`a breit.80 tief.40 hoch.72` - dimensions written out.

`a 80,40,72` - short form for the same dimensions.

## Inheritance And Integrated Cabinets

A cabinet can inherit from another cabinet. The new name is written before the dot, the existing cabinet after the dot.

`b.a x.100` - cabinet `b` inherits from `a` and additionally gets `x.100`.

A cabinet can also be integrated permanently into another cabinet. In that case the parent is written before the dot.

`a.handle p.fr breit.12 tief.2 hoch.2 x.40 y.-2 z.36` - `handle` belongs permanently to `a`.

When `a` is copied or repeated later, `a.handle` is copied with it automatically.

`a n2y` - creates `a` and `a1y`.

`a.handle ...` - additionally creates `a.handle` and `a1y.handle`.

Inherited cabinets also take integrated children with them:

`b.a x.100` - creates `b` and also `b.handle` if `a.handle` exists.

The old group syntax with `+`, for example `b.a+`, `ba+` or `b+a`, is no longer used.

## Numbers

- `3` absolute value
- `+3` relative value
- `+-3` relative negative value
- `3,5,7` list

Dimensions are written in centimeters. Material thicknesses in the project line are written in millimeters.

## First Line

`test_shelf mat.19,wh mat.8,gr` - project name with two materials.

The first line contains:

- project name
- materials
- optional project values such as `xx`, `xy`, `xz`
- optional default values for cabinets

`mat.19,wh` - material 1, 19 mm thick, color `wh`.

`mat.19,darkblue,16` - material with a color name, 19 mm thick, color dark blue, price 16.

## Parts

`p` defines which parts a cabinet contains. `p` belongs only on the cabinet, not on individual parts. The order is important.

`a p.sl,sr,bo,de,rw,eb` - cabinet `a` with sides, bottom, top, back and shelf.

Part codes:

- `l` left side
- `r` right side
- `g` bottom
- `t` top
- `b` back
- `f` front
- `c` shelf
- `v` center panel

## Directions

- `x` left/right
- `y` front/back
- `z` bottom/top
- `l` left
- `r` right
- `g` bottom
- `t` top
- `b` back
- `f` front

## Properties

- `p` cabinet parts
- `w` width
- `d` depth
- `h` height
- `x` position in x direction
- `y` position in y direction
- `z` position in z direction
- `m` material
- `nx`, `ny`, `nz` repetition
- `sx`, `sy`, `sz` splitting
- `u` shrink or extend
- `i` connect
- `fit` fit to two points
- `o` rotate
- `vi` display
- `#` comment
- `-` disable line or property

## Dimensions

`a breit.80 tief.40 hoch.72` - width, depth and height written out.

`a 80,40,72` - short form for width, depth and height.

`breit`, `tief`, `hoch` mean width, depth and height.

## Position

`a x.20` - position in x direction.

`a y.10` - position in y direction.

`a z.5` - position in z direction.

`a x20` - old short form for `x.20`.

`a y10` - old short form for `y.10`.

`a z5` - old short form for `z.5`.

## Material

Material can be set on the cabinet or on a part.

`a mat.1` - material on the cabinet.

`a rw.mat.2` - material on the back.

`a fr.mat.1` - material on the front.

## Shrink And Extend

`push` changes parts on specific sides.

`a push.8` - can be used for plinth or cabinet shortening.

`a fr.push.0.4` - shrinks the front on the matching sides by 0.4 cm.

`a eb.push.2f` - shortens the shelf at the front by 2 cm.

`a eb.push.2f,1b` - shortens the shelf differently at the front and back.

`a sl.push.7f,9tg` - shortens the left side by 7 cm at the front and by 9 cm at top/bottom.

## Repeat

`x.n`, `y.n`, `z.n` create repetitions.

`a x.n3,10` - three repetitions in x direction with spacing 10.

`a y.n2,5` - two repetitions in y direction with spacing 5.

`a z.n4,20` - four repetitions in z direction with spacing 20.

The first value is the count. The second value is the spacing.

## Split

`teilen.x`, `teilen.y`, `teilen.z` split a part into several smaller parts.

`a fr.teilen.x.3,5` - split the front in x direction into three parts, spacing 5.

`a fr.teilen.y.2,1` - split the front in y direction into two parts, spacing 1.

`a fr.teilen.z.4,2` - split the front in z direction into four parts, spacing 2.

The first value is the number of parts. The second value is the spacing between the parts.

Combinations create a grid:

`a fr.teilen.x.3,5 fr.teilen.z.2,4` - grid from x and z splitting.

`a fr.teilen.x.2,5 fr.teilen.y.3,2 fr.teilen.z.2,4` - creates `2 x 3 x 2` parts.

Unequal values can be written directly on dimensions or positions:

`a sl.hoch.40,30,6g,20,1` - creates several unequal height pieces; `6g` or `g6` is the global gap between all pieces, a final `1` fills to the end.

`a sl.hoch.2/2,1g(gap)` - splits the height into two equal pieces with a 1 cm gap.

`a sl.breit.dito` - reuses the previous value sequence.

`a sl.x.1,10,20` - repeats the part at unequal x positions.

## Connect

`i` connects a point of the current cabinet to a target point.

`b i` - connects the current cabinet to the previous cabinet.

`b i=a,,0_b,,3` - connects point 0 of the current cabinet to point 3 of cabinet `a`.

`b i=f,0,a,g,3` - connects part `f`, corner 0, to cabinet `a`, part `g`, corner 3.

`b i1` - connects the current cabinet to corner 1.

Format: `i=current_part,current_corner,target_cabinet,target_part,target_corner`.

If only `i` is written, the current cabinet is connected to the previous cabinet.

## Fit To Two Points

`fit` calculates `w`, `d`, `h` from two points. Point 1 is set as the target point.

`b fit=a,g,1_a,c,7` - calculates the dimensions of `b` from the points `a,g,1` and `a,c,7`.

`b fit=ag1_ac7` - short form for the same fit.

This means:

- point 1 is `a,g,1`
- point 2 is `a,c,7`
- `b.w`, `b.d`, `b.h` are calculated from the distance between both points
- `b.tar` is set to point 1
- `b.cur` remains corner 0 of the new cabinet

## Rotate

`o` rotates with an axis suffix.

`a o=45z` - rotates cabinet `a` by 45 degrees around the z axis.

`a l.o=9z` - rotates part `l` by 9 degrees around the z axis.

`a o=15x,9z0` - rotates around x and z; in `9z0`, `0` is the pivot corner.

## Display

`vi` controls the display.

`a vi=wf` - wireframe.

`a f.vi=t4` - transparency level for the front.

## Points

A point consists of cabinet, part and corner.

`al1` - cabinet `a`, part `l`, corner `1`.

`a,l,1` - same point written with commas.

## Corners

- front side: 0 to 3, clockwise, starting bottom left
- back side: 4 to 7, clockwise
- default point of the current cabinet: 0
- default target point: 3

Front: `0` bottom left, `1` top left, `2` top right, `3` bottom right.

Back: `4` bottom left, `5` top left, `6` top right, `7` bottom right.

## Comments And Disabling

`a i1` - connects the current cabinet to corner 1.

`-a p.sl,sr,bo,de,rw,eb breit.80 tief.40 hoch.72` - disabled line.

Everything after `#` is a comment. It is best to write comments after the code. Lines or blocks with `-` are disabled.
