#!/bin/bash
#rsync -avz ~/c3-23/ ch@3dfg.de:/home/ch/c3-23/ --exclude=gallery/
#ssh ch@3dfg.de 'pm2 restart 0'

#!/bin/bash
git add .
git commit -m "update"
git push

ssh ch@3dfg.de "
cd /home/ch/3dfg &&
git pull &&
pm2 restart all
"
#npm install &&