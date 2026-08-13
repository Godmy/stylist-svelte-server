import fs from 'node:fs';
import path from 'node:path';
import { loadDomainComponentDescriptors } from '$stylist/server/function/async/load-domain-component-descriptors';
import { LIB_DIRECTORY_PATH } from '$stylist/server/const/value/lib-directory-path';
import type { TypeDomainComponentDescriptor } from '$stylist/domain/type/object/domain-component-descriptor';

export function loadDomainPageData(): {
	tree: Array<{
		name: string;
		clusters: Array<{
			name: string;
			joints: Array<{
				name: string;
				entities: Array<{
					name: string;
					path: string;
					files: Array<{
						name: string;
						path: string;
					}>;
				}>;
			}>;
		}>;
	}>;
	descriptors: TypeDomainComponentDescriptor[];
} {
	type DomainFile = {
		name: string;
		path: string;
	};

	type DomainEntity = {
		name: string;
		path: string;
		files: DomainFile[];
	};

	type DomainJoint = {
		name: string;
		entities: DomainEntity[];
	};

	type DomainCluster = {
		name: string;
		joints: DomainJoint[];
	};

	type DomainTreeNode = {
		name: string;
		clusters: DomainCluster[];
	};

	function buildDomainNode(domainName: string): DomainTreeNode | null {
		const domainPath = path.join(LIB_DIRECTORY_PATH, domainName);
		const clusterNames = fs
			.readdirSync(domainPath, { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name)
			.filter((name) => !name.startsWith('.'));

		const clusters = clusterNames
			.map((clusterName) => buildClusterNode(domainName, clusterName))
			.filter((node): node is DomainCluster => node !== null);

		if (clusters.length === 0) {
			return null;
		}

		return { name: domainName, clusters };
	}

	function buildClusterNode(domainName: string, clusterName: string): DomainCluster | null {
		const clusterPath = path.join(LIB_DIRECTORY_PATH, domainName, clusterName);
		const jointNames = fs
			.readdirSync(clusterPath, { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name);

		const joints = jointNames
			.map((jointName) => buildJointNode(domainName, clusterName, jointName))
			.filter((node): node is DomainJoint => node !== null);

		if (joints.length === 0) {
			return null;
		}

		return { name: clusterName, joints };
	}

	function buildJointNode(
		domainName: string,
		clusterName: string,
		jointName: string
	): DomainJoint | null {
		const jointPath = path.join(LIB_DIRECTORY_PATH, domainName, clusterName, jointName);
		const entities = collectEntities(domainName, clusterName, jointName, jointPath);

		if (entities.length === 0) {
			return null;
		}

		return { name: jointName, entities };
	}

	function collectEntities(
		domainName: string,
		clusterName: string,
		jointName: string,
		jointPath: string
	): DomainEntity[] {
		const entities: DomainEntity[] = [];

		for (const entry of fs.readdirSync(jointPath, { withFileTypes: true })) {
			if (!entry.isDirectory()) {
				continue;
			}

			const entityPath = path.join(jointPath, entry.name);
			const files = collectEntityFiles(entityPath);

			if (files.length > 0) {
				entities.push({
					name: entry.name,
					path: `${domainName}/${clusterName}/${jointName}/${entry.name}`,
					files
				});
				continue;
			}

			for (const nestedEntity of collectNestedEntities(
				domainName,
				clusterName,
				jointName,
				entry.name,
				entityPath
			)) {
				entities.push(nestedEntity);
			}
		}

		return entities.sort((left, right) => left.name.localeCompare(right.name));
	}

	function collectNestedEntities(
		domainName: string,
		clusterName: string,
		jointName: string,
		parentName: string,
		parentPath: string
	): DomainEntity[] {
		const entities: DomainEntity[] = [];

		for (const entry of fs.readdirSync(parentPath, { withFileTypes: true })) {
			if (!entry.isDirectory()) {
				continue;
			}

			const entityPath = path.join(parentPath, entry.name);
			const files = collectEntityFiles(entityPath);

			if (files.length === 0) {
				continue;
			}

			entities.push({
				name: `${parentName}/${entry.name}`,
				path: `${domainName}/${clusterName}/${jointName}/${parentName}/${entry.name}`,
				files
			});
		}

		return entities.sort((left, right) => left.name.localeCompare(right.name));
	}

	function collectEntityFiles(entityPath: string): DomainFile[] {
		return fs
			.readdirSync(entityPath, { withFileTypes: true })
			.filter((entry) => entry.isFile())
			.map((entry) => ({
				name: entry.name,
				path: path
					.relative(LIB_DIRECTORY_PATH, path.join(entityPath, entry.name))
					.replace(/\\/g, '/')
			}))
			.sort((left, right) => left.name.localeCompare(right.name));
	}

	const tree = fs
		.readdirSync(LIB_DIRECTORY_PATH, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((domainEntry) => buildDomainNode(domainEntry.name))
		.filter((node): node is DomainTreeNode => node !== null)
		.sort((left, right) => left.name.localeCompare(right.name));

	return {
		tree,
		descriptors: loadDomainComponentDescriptors()
	};
}


