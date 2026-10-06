import type {
	CreatePackageSessionError as LibCreatePackageSessionError,
	ReschedulePackageSessionError as LibReschedulePackageSessionError,
	UnschedulePackageSessionError as LibUnschedulePackageSessionError
} from "#convex/lib/packages/packageScheduling";

export type CreatePackageSessionError = LibCreatePackageSessionError;

export type ReschedulePackageSessionError = LibReschedulePackageSessionError;

export type UnschedulePackageSessionError = LibUnschedulePackageSessionError;
