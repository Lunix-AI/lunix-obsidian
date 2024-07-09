/*
const npm = new NpmApi();
const repo = npm.repo('react');
const pkg = await repo.package();

console.log(pkg.version)

*/
declare module "npm-api" {
	interface Repo {
		package(): Promise<Package>;
	}

	interface Package {
		version: string;
	}

	class NpmApi {
		constructor();
		repo(name: string): Repo;
	}

	export default NpmApi;
}
