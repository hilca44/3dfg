#!/bin/bash
#rsync -avz ~/c3-23/ ch@3dfg.de:/home/ch/c3-23/ --exclude=gallery/
#ssh ch@3dfg.de 'pm2 restart 0'

#!/bin/bash
git add .
git commit -m "update"
git push

ssh ch@3dfg.de "
cd /home/ch/3dfg &&
mkdir -p data/schreinertool/gallery/users &&
if [ -f public/schreinertool/gallery/users.json ] && [ ! -f data/schreinertool/gallery/users.json ]; then cp public/schreinertool/gallery/users.json data/schreinertool/gallery/users.json; fi &&
if [ -f public/schreinertool/gallery/paid-emails.json ] && [ ! -f data/schreinertool/gallery/paid-emails.json ]; then cp public/schreinertool/gallery/paid-emails.json data/schreinertool/gallery/paid-emails.json; fi &&
if [ -f public/schreinertool/gallery/db.json ] && [ ! -f data/schreinertool/gallery/db.json ]; then cp public/schreinertool/gallery/db.json data/schreinertool/gallery/db.json; fi &&
if [ -d public/schreinertool/gallery/users ]; then cp -rn public/schreinertool/gallery/users/. data/schreinertool/gallery/users/; fi &&
git pull &&
pm2 restart all
"
#npm install &&
