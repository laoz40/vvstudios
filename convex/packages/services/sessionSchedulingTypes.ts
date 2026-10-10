import type {
	CreatePackageSessionError as LibCreatePackageSessionError,
	ReschedulePackageSessionError as LibReschedulePackageSessionError,
	UnschedulePackageSessionError as LibUnschedulePackageSessionError
} from "#convex/packages/lib/scheduling";

export type CreatePackageSessionError = LibCreatePackageSessionError;

export type ReschedulePackageSessionError = LibReschedulePackageSessionError;

export type UnschedulePackageSessionError = LibUnschedulePackageSessionError;
