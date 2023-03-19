const fs = require('fs')
const path = require('path')
const axios = require('axios')

const second = 1000
const minute = second * 60

class CacheError extends Error {
  constructor(message) {
    super(message)
    this.name = "CacheError"
		this.message = message
  }
}

class APICache {

	constructor(cacheDir, maxAge, defaultExtension, funk, functionResponseProp, functionParams) {
    this.maxAge = maxAge
		this.responseProp = functionResponseProp
		this.funk = funk
		this.params = functionParams
		this.verbose = false
		if(path.basename(cacheDir).includes('.')){
			this.dir = path.dirname(cacheDir) + '/'
			this.fileName = path.basename(cacheDir)
			this.ext = '.' + path.basename(cacheDir).split('.')[1]
		}else{
			if(cacheDir.slice(-1) === '/'){
				this.dir = cacheDir
			}else{
				this.dir = cacheDir + '/'
			}
			this.ext = defaultExtension
			this.fileName = undefined
		}
		!fs.existsSync(this.dir)? fs.mkdirSync(this.dir, { recursive: true }): null
		console.log(this.funk)
  }

	cacheData(data){
		return new Promise((resolve, reject)  => {
			let now = (new Date).getTime()
			if(this.fileName == undefined){
				fs.writeFile(this.dir + '/' + now + this.ext, JSON.stringify(data, null, 4), (err) => {
					if(err){
						throw err
					}else{ 
						this.verbose? console.log('DATA CACHED, ' + this.dir + now + this.ext + '\n' + ((now - (new Date())) + this.maxAge)/1000 + ' seconds until outdated'): null
						resolve()
					}
				})
			}else{
				fs.writeFile(this.dir + '/' + this.fileName, JSON.stringify(data, null, 4), (err) => {
					if(err){
						 throw err
					}else{
						this.verbose? console.log('DATA CACHED, ' + this.dir + this.fileName + '\n' + (now - (new Date()) + this.maxAge)/1000 + ' seconds until outdated'): null
						resolve()
					}
				})
			}
		})
	}

	getCachedData(){
		return new Promise((resolve, reject)  => {
			fs.readdir(this.dir, (err, files) => {
				files = files.filter((a) => {return a.includes(this.ext)})
				this.verbose? console.log('ALREADY CACHED FILES: '+ files.length): null
				if(files.length > 0){
					files = files.sort((a, b) => {
						return new Date(fs.statSync(path.join(this.dir, b)).birthtime) - new Date(fs.statSync(path.join(this.dir, a)).birthtime)
					})
					fs.readFile(path.join(this.dir, files[0]), (err, data) => {
						if (err) throw err
						resolve(data)
					})
				}else{
					throw new CacheError('no files with specified extension in cache directory')
				}
			})
		})
	}

	requestNewData(writeIt){
		return new Promise((resolve, reject)  => {
			let self = this
			this.funk(this.params).then(function(response){
				if(response.hasOwnProperty(self.responseProp)){
					self.verbose? console.log('RESPONSE IS VALID, response properties: '+ Object.keys(response).join(', ')): null
					if(writeIt === true){
						self.cacheData(response[self.responseProp]).then(() => {
							resolve(response[self.responseProp])
						})
					}else{
						resolve(response[self.responseProp])
					}
				}else{
					throw new CacheError('data request did not resolve object with \'' + self.responseProp + '\' property.')
				}
			})
		})
	}

	isUpdated(){
		return new Promise((resolve, reject)  => {
			if(this.fileName !== undefined){
				if(fs.existsSync(this.dir+this.fileName)){
					let youngestAge = new Date(fs.statSync(this.dir+this.fileName).birthtime)
					let now = new Date()
					this.maxAge > (now.getTime() - youngestAge.getTime())? resolve(true): resolve(false)
				}else{
					resolve(false)
				}
			}else{
				fs.readdir(this.dir, (err, files) => {
					files = files.filter((a) => {return a.includes(this.ext)})
					if(files.length > 0){
						files = files.sort((a, b) => {
							return new Date(fs.statSync(path.join(this.dir, b)).birthtime) - new Date(fs.statSync(path.join(this.dir, a)).birthtime)
						})
						let youngestAge = new Date(fs.statSync(path.join(this.dir, files[0])).birthtime)
						let now = new Date()
						this.verbose? console.log('CHECKING AGE OF YOUNGEST FILE: ( ' + this.maxAge/1000 + 's > ' + (now.getTime() - youngestAge.getTime())/1000+ 's  )?'): null
						this.maxAge > (now.getTime() - youngestAge.getTime())? resolve(true): resolve(false)
					}else{
						resolve(new CacheError('no files with specified extension in cache directory'))
					}
				})
			}
		})
	}

	cache(){
		return new Promise((resolve, reject)  => {
			this.isUpdated().then((updated) => {
				if(updated === true){
					this.getCachedData().then((response) => {
						this.verbose? console.log('SENDING LOCAL FILE'): null
						resolve(response)
					})
				}else if(updated === false || updated instanceof CacheError){
					this.requestNewData(true).then((response) => {
						this.verbose? console.log('CACHE WAS OUTDATED, WRITING AND SENDING NEW DATA'): null
						resolve(response)
					})
				}
			})
		})
	}

	setVerbose(){ this.verbose = true }

}

module.exports = APICache