.PHONY:	build push

# The current value of the tag to be used for building and
# pushing an image to gcr.io
TAG?=1.0.1
IMAGE=quay.io/dpratt/route53-presence

build:
	docker build --pull --rm -t $(IMAGE):$(TAG) .

push: build
	docker tag $(IMAGE):$(TAG) $(IMAGE):latest
	docker push $(IMAGE):$(TAG)
	docker push $(IMAGE):latest

run: build
	docker run --rm -it --name route53-presence $(IMAGE):$(TAG)
