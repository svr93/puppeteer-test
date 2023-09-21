FROM node:lts-alpine

ENV CHROME_BIN="/usr/bin/chromium-browser" \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD="true"

RUN set -x \
    && apk update \
    && apk upgrade \
    && apk add --no-cache \
    udev \
    ttf-freefont \
    chromium

ADD package.json /usr/local/voting/
ADD package-lock.json /usr/local/voting/

WORKDIR "/usr/local/voting"

RUN npm ci

ADD src src
