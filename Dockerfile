FROM node:latest

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

CMD [ "node", "index.js" ]

COPY package.json /usr/src/app/
RUN npm install
COPY index.js /usr/src/app/
