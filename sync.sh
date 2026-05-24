#!/bin/bash
rsync -avz ~/c3-23/ ch@3dfg.de:/home/ch/c3-23/ --exclude=gallery/
ssh ch@3dfg.de 'pm2 restart 0'
