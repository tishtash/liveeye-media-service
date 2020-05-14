## Creating potential production image
FROM woahbase/alpine-supervisor:x86_64
WORKDIR /liveeye-media-service
RUN apk update && apk add bash ca-certificates ffmpeg nodejs-current npm && rm -rf /var/cache/apk/*
COPY package*.json /liveeye-media-service/
RUN npm install
COPY ./build/management/supervisord.conf /etc/supervisord.conf
COPY . /liveeye-media-service
EXPOSE 8080


# REMOVE ALL IMAGES
# docker rmi $(docker images -a -q)